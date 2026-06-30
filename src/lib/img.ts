// Proxy Printful/other CDN images through wsrv.nl to dodge CORS blocks
// and get on-the-fly resizing. Shared by the grid and the product modal.
export function proxyImageUrl(url: string): string {
  if (!url) return url;
  if (url.includes("files.cdn.printful.com")) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&n=-1`;
  }
  return url;
}
