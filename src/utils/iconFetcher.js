function normalizeWebUrl(value) {
  const trimmedValue = value.trim();
  const urlWithProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  const parsedUrl = new URL(urlWithProtocol);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  if (!parsedUrl.hostname.includes(".")) {
    throw new Error("Please enter a valid website URL");
  }

  return parsedUrl.href;
}

function getFavicon(url) {
  const parsedUrl = new URL(url);
  return `https://www.google.com/s2/favicons?sz=64&domain=${parsedUrl.hostname}`;
}

module.exports = { getFavicon, normalizeWebUrl };
