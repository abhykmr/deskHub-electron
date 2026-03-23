function getFavicon(url) {
  const parsedUrl = new URL(url);
  return `https://www.google.com/s2/favicons?sz=64&domain=${parsedUrl.hostname}`;
}

module.exports = { getFavicon };
