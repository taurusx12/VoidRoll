# Aura Card System

This version renders a custom PNG card when `/roll` is used.
Strong characters get unique aura themes:

- Satoru Gojo: Hollow Purple aura
- Gon Freecss: green Jajanken aura
- Sukuna: red/black Malevolent aura
- Naruto: orange Nine-Tails chakra aura
- Goku: silver/blue Ultra Instinct aura
- Zoro: green Ashura aura

If a character does not have a custom aura, the bot uses the rarity aura automatically.

Edit aura themes in:

`src/lib/aura.js`

The renderer is here:

`src/services/cardRender.js`

The card image is generated dynamically, so market/inventory/roll pages can reuse the same function later.
