const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');
const { clampPrice, priceLimit } = require('./economy');

async function listCard(userId, cardId, price) {
  const card = await prisma.userCard.findFirst({
    where: { id: cardId, userId },
    include: { character: true }
  });
  if (!card) throw new Error('Card not found in your inventory.');
  if (card.locked) throw new Error('This card is locked.');

  const limit = priceLimit(card.character.rarity);
  if (!clampPrice(card.character.rarity, price)) {
    throw new Error(`${card.character.rarity} price range: ${limit.min.toLocaleString()} - ${limit.max.toLocaleString()} gold.`);
  }

  const existing = await prisma.marketListing.findFirst({ where: { cardId, status: 'ACTIVE' } });
  if (existing) throw new Error('This card is already listed.');

  return prisma.marketListing.create({
    data: { id: nanoid(), sellerId: userId, cardId, price: BigInt(price) }
  });
}

async function latest(limit = 10) {
  return prisma.marketListing.findMany({
    where: { status: 'ACTIVE' },
    include: { card: { include: { character: true } }, seller: true },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

async function buy(userId, listingId) {
  const listing = await prisma.marketListing.findFirst({
    where: { id: listingId, status: 'ACTIVE' },
    include: { card: { include: { character: true } }, seller: true }
  });
  if (!listing) throw new Error('Listing not found.');
  if (listing.sellerId === userId) throw new Error('You cannot buy your own listing.');

  const buyer = await prisma.user.findUnique({ where: { id: userId } });
  if (!buyer || buyer.gold < listing.price) throw new Error('Not enough gold.');

  const tax = listing.price / BigInt(20); // 5%
  const sellerAmount = listing.price - tax;

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { gold: { decrement: listing.price } } }),
    prisma.user.update({ where: { id: listing.sellerId }, data: { gold: { increment: sellerAmount } } }),
    prisma.userCard.update({ where: { id: listing.cardId }, data: { userId } }),
    prisma.marketListing.update({ where: { id: listing.id }, data: { status: 'SOLD', soldAt: new Date() } })
  ]);

  return { listing, tax };
}

module.exports = { listCard, latest, buy };
