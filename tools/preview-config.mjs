export function previewConfig(args,interfaces) {
  if(args.some(arg => arg !== '--phone')) throw new Error('Only --phone is supported');
  const phone=args.includes('--phone');
  const urls=phone ? Object.entries(interfaces).flatMap(([name,addresses]) => (addresses || [])
    .filter(a => !a.internal && a.family === 'IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(a.address))
    .map(a => ({name,url:`http://${a.address}:8765/`}))) : [];
  return {host:phone ? '0.0.0.0' : '127.0.0.1',phone,urls};
}
