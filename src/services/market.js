const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');
const config = require('../lib/config');
async function sell(userId, cardId, price) {
  price = BigInt(price);
  if (price <= 0n) throw new Error('Invalid price');
  const card = await prisma.userCard.findFirst({ where: { id: cardId, userId, locked: false } });
  if (!card) throw new Error('Card not found or locked');
  const active = await prisma.marketListing.findFirst({ where: { cardId, status: 'ACTIVE' } });
  if (active) throw new Error('Card already listed');
  return prisma.marketListing.create({ data: { id: nanoid(10), sellerId: userId, cardId, price } });
}
async function buy(buyerId, listingId) {
  return prisma.$transaction(async tx => {
    const listing = await tx.marketListing.findUnique({ where: { id: listingId }, include: { card: true } });
    if (!listing || listing.status !== 'ACTIVE') throw new Error('Listing unavailable');
    if (listing.sellerId === buyerId) throw new Error('Cannot buy your own listing');
    const buyer = await tx.user.findUnique({ where: { id: buyerId } });
    if (!buyer || buyer.gold < listing.price) throw new Error('Not enough gold');
    const tax = (listing.price * BigInt(config.marketTaxBps)) / 10000n;
    const payout = listing.price - tax;
    await tx.user.update({ where: { id: buyerId }, data: { gold: { decrement: listing.price } } });
    await tx.user.update({ where: { id: listing.sellerId }, data: { gold: { increment: payout } } });
    await tx.userCard.update({ where: { id: listing.cardId }, data: { userId: buyerId } });
    await tx.marketListing.update({ where: { id: listingId }, data: { status: 'SOLD', soldAt: new Date() } });
    return { listing, tax, payout };
  });
}
async function latest(limit=10) {
  return prisma.marketListing.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: limit, include: { card: { include: { character: true } }, seller: true } });
}
module.exports = { sell, buy, latest };
