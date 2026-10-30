// Updates wait for a tap so a new worker cannot interrupt an unfinished form.
export async function setupUpdates(nav,win,notice,button) {
  if (!nav.serviceWorker) return;
  let waiting,requested=false;
  const offer=worker => {if(worker) {waiting=worker;notice.hidden=false;}};
  button.addEventListener('click',() => {
    if(!waiting) return;
    requested=true;button.disabled=true;
    waiting.postMessage({type:'ACTIVATE_UPDATE'});
  });
  nav.serviceWorker.addEventListener('controllerchange',() => {
    if(requested) win.location.reload();
  });
  try {
    const registration=await nav.serviceWorker.register('./sw.js',{updateViaCache:'none'});
    offer(registration.waiting);
    registration.addEventListener('updatefound',() => {
      const worker=registration.installing;
      worker?.addEventListener('statechange',() => {
        if(worker.state === 'installed' && nav.serviceWorker.controller) offer(registration.waiting);
      });
    });
  } catch { /* The online app still works without offline storage. */ }
}
