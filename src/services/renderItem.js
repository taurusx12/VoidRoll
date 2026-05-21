const path = require('path');

function getItemImage(item) {
  return path.join(
    process.cwd(),
    'src',
    item.imageUrl
  );
}

module.exports = { getItemImage };
