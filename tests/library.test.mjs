import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FAVORITES_STORAGE,CATEGORIES,favoriteKey,validateFavorites,loadFavorites,saveFavorites,selectRoutes} from '../companion/library.mjs';
import {movingMinutes} from '../companion/route-utils.mjs';

const entries=[{route:{id:'a',categories:['quick','trails']},key:'route:a'},
  {route:{id:'b',categories:['parks']},key:'route:b'},
  {route:{name:'Custom'},key:'import:abc',imported:true}];
test('category and favorite filters intersect without changing library order',() => {
  assert.equal(selectRoutes(entries).length,3);
  assert.deepEqual(selectRoutes(entries,{category:'quick'}),[entries[0]]);
  assert.deepEqual(selectRoutes(entries,{category:'imported'}),[entries[2]]);
  assert.deepEqual(selectRoutes(entries,{category:'parks',favoritesOnly:true,favorites:['route:a']}),[]);
  assert.deepEqual(selectRoutes(entries,{favoritesOnly:true,favorites:['import:abc','route:b']}),[entries[1],entries[2]]);
  assert.equal(entries.length,3);
});
test('favorite identities survive reordering/reload and distinguish equal GPX filenames',() => {
  const track={name:'Ride',points:[[40,-80],[40.001,-80.001]]};
  assert.equal(favoriteKey({id:'schenley',name:'Renamed ride'}),'route:schenley');
  assert.equal(favoriteKey(track,true),favoriteKey(JSON.parse(JSON.stringify(track)),true));
  assert.notEqual(favoriteKey(track,true),favoriteKey({...track,points:[[40,-80],[40.002,-80.001]]},true));
});
test('favorites persist independently of ride records and retain currently unknown route IDs',() => {
  const data=new Map([['pogoh-rides-v1','keep this ride log']]);
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  assert.deepEqual(loadFavorites(storage),{keys:[],persistent:true});
  assert.equal(saveFavorites(['route:schenley','route:future-route'],storage),true);
  assert.deepEqual(loadFavorites(storage).keys,['route:schenley','route:future-route']);
  assert.equal(data.get('pogoh-rides-v1'),'keep this ride log');
});
test('unreadable storage and failed writes report temporary state without clearing saved data',() => {
  let value='{broken';let writes=0;
  const storage={getItem:()=>value,setItem(){writes++;throw Error('full');}};
  assert.deepEqual(loadFavorites(storage),{keys:[],persistent:false});
  assert.equal(value,'{broken');assert.equal(writes,0);
  assert.equal(saveFavorites(['route:schenley'],storage),false);
  assert.equal(value,'{broken');
  assert.deepEqual(loadFavorites({getItem(){throw Error('private');}}),{keys:[],persistent:false});
});
test('favorite import validation rejects malformed data and deduplicates IDs',() => {
  for(const bad of [null,{},['<script>'],['route:'],[1],Array(1001).fill('route:a')]) assert.throws(()=>validateFavorites(bad));
  assert.deepEqual(validateFavorites(['route:a','route:a']),['route:a']);
});
test('every built-in ride has valid categories and quick rides have short moving estimates',async () => {
  const routes=JSON.parse(await readFile(new URL('../companion/routes.json',import.meta.url),'utf8'));
  assert.equal(new Set(routes.map(x=>x.id)).size,routes.length);
  for(const route of routes) {
    assert.ok(route.categories.length>0);
    for(const category of route.categories) assert.ok(CATEGORIES[category] && !['all','imported'].includes(category));
    if(route.categories.includes('quick')) assert.ok(movingMinutes(route).max<=25);
  }
});
