export function publicPath(pathname){return pathname==='/'||pathname==='/index.html'||/^\/(js|css|assets)\/[a-zA-Z0-9_./-]+$/.test(pathname)&&!pathname.split('/').some(part=>part.startsWith('.'));}
