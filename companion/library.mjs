export const CATEGORIES={all:'All rides',quick:'Quick rides',parks:'Park & hills',trails:'River trails',longer:'Longer rides',imported:'Imported'};
export const FAVORITES_STORAGE='pogoh-favorites-v1';

export function favoriteKey(route,imported=false) {
  if(!imported) return `route:${route.id}`;
  // Imported files need an identity that survives reloads and list reordering.
  // Hash both geometry and name; equal filenames alone must not join favorites.
  const text=JSON.stringify([route.name,route.points]);let a=2166136261,b=5381;
  for(let i=0;i<text.length;i++) {a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
  return `import:${(a>>>0).toString(16)}-${(b>>>0).toString(16)}-${text.length}`;
}
export function validateFavorites(value) {
  if(!Array.isArray(value) || value.length>1000 || value.some(x => typeof x !== 'string' || !/^(route|import):[a-z0-9-]{1,150}$/.test(x))) throw new Error('Invalid favorites');
  return [...new Set(value)];
}
export function loadFavorites(storage) {
  try {return {keys:validateFavorites(JSON.parse(storage.getItem(FAVORITES_STORAGE) || '[]')),persistent:true};}
  catch {return {keys:[],persistent:false};}
}
export function saveFavorites(keys,storage) {
  try {storage.setItem(FAVORITES_STORAGE,JSON.stringify(validateFavorites(keys)));return true;} catch {return false;}
}
export function selectRoutes(entries,{category='all',favoritesOnly=false,favorites=[]}={}) {
  const saved=new Set(favorites);
  return entries.filter(entry => (category==='all' || (entry.imported ? category==='imported' : entry.route.categories?.includes(category))) &&
    (!favoritesOnly || saved.has(entry.key)));
}
