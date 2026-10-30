import {appleDirectionsURL,routeSharePayload,canShareRoute,shareRouteFile,blankNavigationReport,
  NAVIGATION_CHECKS,WORKFLOWS,validateNavigationReports,navigationReportState} from './navigation.mjs';

const escape=value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='pogoh-navigation-checks-v1';
const EASYROUTE='https://apps.apple.com/us/app/easyroute/id605127860';

export function mountNavigationGuide(container) {
  container.innerHTML=`<details><summary id="navigation-guide-title">Watch setup & help</summary><ol class="navigation-steps"><li>Choose a ride and share or download its GPX.</li><li>Open in <a href="${EASYROUTE}" target="_blank" rel="noopener">EasyRoute</a> with the free Apple map.</li><li>Compare the track, then open it on your Watch.</li></ol><p class="small">Phone import and Watch sync worked in your test. Turns, taps, locked-phone use, and offline use still need checking. Keep your phone connected.</p><p class="small">Apple Maps gets you to the start using its own path. EasyRoute follows the GPX. Skip paid layers and offline-map purchases.</p><p class="small"><a href="https://easyrouteapp.com/importing-gpx-into-easyroute/" target="_blank" rel="noopener">GPX help ↗</a> · <a href="https://easyrouteapp.com/about/" target="_blank" rel="noopener">Watch help ↗</a> · <a href="https://easyrouteapp.com/subscriptions/" target="_blank" rel="noopener">Free map features ↗</a> · <a href="https://support.apple.com/guide/watch/get-directions-apdea7480950/watchos" target="_blank" rel="noopener">Apple Maps help ↗</a></p></details>`;
}
function exportReports(reports) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(reports,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='pogoh-device-checks.json';a.click();setTimeout(() => URL.revokeObjectURL(url),1000);
}
export function mountRouteNavigation(container,route,{isImported=false}={}) {
  if(!isImported && (route.status !== 'map-reviewed' || !route.review?.geometryHash)) {
    container.innerHTML='<h3>Navigation is not ready</h3><p class="small">This starter track needs map review before its GPX handoff and device check are available.</p>';return;
  }
  container.innerHTML=`<h3 tabindex="-1">Follow this ride</h3>${!isImported ? `<div class="navigation-step"><h4>Get to the start</h4><div class="actions"><a class="button outline" href="${appleDirectionsURL(route.destination,'walking')}">Walk to start ↗</a><a class="button outline" href="${appleDirectionsURL(route.destination,'cycling')}">Cycle to start ↗</a></div><p class="small">Apple Maps chooses the approach.</p></div>` : ''}
    <div class="navigation-step"><h4>Follow the track</h4><div class="actions navigation-share-actions"></div><p class="small navigation-share-help"></p><p class="navigation-share-status small" role="status"></p></div>
    ${!isImported ? '<details class="device-check"><summary>Optional device checks</summary><div class="device-check-body"></div></details>' : '<p class="small">Imported track: check access and geometry before riding.</p>'}`;
  const actions=container.querySelector('.navigation-share-actions'),status=container.querySelector('.navigation-share-status');
  const payload=routeSharePayload(route),supported=canShareRoute(payload,navigator,globalThis.isSecureContext);
  if(supported) {
    const button=document.createElement('button');button.className='button primary';button.textContent='Share GPX file…';
    button.addEventListener('click',async () => {
      button.disabled=true;
      try {
        const outcome=await shareRouteFile(route,navigator,globalThis.isSecureContext);
        status.textContent={shared:'Shared. Open in EasyRoute, then on your Watch.',
          cancelled:'Sharing cancelled.',unsupported:'File sharing is unavailable here. Use Download GPX, then open it from Files.',
          failed:'The file could not be shared. Use Download GPX, then open it from Files.'}[outcome];
      } catch {status.textContent='The file could not be prepared. Use Download GPX above.';}
      finally {button.disabled=false;}
    });
    actions.append(button);
  }
  const guide=document.createElement('a');guide.className='button outline';guide.href=EASYROUTE;guide.target='_blank';guide.rel='noopener';guide.textContent='EasyRoute ↗';actions.append(guide);
  container.querySelector('.navigation-share-help').textContent=supported ?
    'Choose EasyRoute in the share sheet, then open the route on your Watch.' :
    'Download GPX → Files → Share → EasyRoute → Watch.';
  if(!isImported) mountDeviceCheck(container.querySelector('.device-check-body'),route);
}
function mountDeviceCheck(container,route) {
  let reports=[],blocked=false,problem='',workflow='easyroute',drafts={};
  try {const raw=localStorage.getItem(STORAGE);reports=validateNavigationReports(raw ? JSON.parse(raw) : []);}
  catch {blocked=true;problem='Saved device checks could not be read. The stored copy is preserved; export new checks before closing.';}
  const findReport=mode => reports.find(r => r.routeId === route.id && r.workflow === mode);
  const draftFor=mode => {
    if(drafts[mode]) return drafts[mode];
    const prior=findReport(mode);
    // A changed track starts with untested fields, never carried-over passes.
    return drafts[mode]=prior?.geometryHash === route.review.geometryHash ? structuredClone(prior) : blankNavigationReport(route,mode);
  };
  const options='<option value="untested">Not tested</option><option value="passed">Worked</option><option value="failed">Didn’t work</option><option value="unavailable">Unavailable</option>';
  container.innerHTML=`<p class="small">Record what worked. Saved in this browser only.</p><p class="notice device-check-state" role="status"></p><form class="device-check-form"><label>Workflow<select name="workflow">${Object.entries(WORKFLOWS).map(([id,v]) => `<option value="${id}">${escape(v.label)}</option>`).join('')}</select></label><div class="form-row"><label>iOS version<input name="ios" maxlength="30" required></label><label>watchOS version<input name="watchos" maxlength="30" required></label></div><label>Navigation app version (optional)<input name="appVersion" maxlength="60"></label><div class="device-check-rows">${NAVIGATION_CHECKS.map(c => `<label class="device-check-row" data-check="${c.id}"><span>${escape(c.label)}${c.optional ? ' (optional)' : ''}</span><select name="${c.id}">${options}</select></label>`).join('')}</div><label>Notes<textarea name="notes" maxlength="2000" rows="3" placeholder="What worked, what changed, or where guidance stopped"></textarea></label><div class="actions"><button class="button primary" type="submit">Save my results</button><button class="button outline device-check-export" type="button">Export device checks</button></div><p class="small device-check-message" role="status"></p></form>`;
  const form=container.querySelector('form'),message=container.querySelector('.device-check-message');
  const fields=form.elements;
  function collect() {
    return {...draftFor(workflow),workflow,geometryHash:route.review.geometryHash,ios:fields.namedItem('ios').value.trim(),
      watchos:fields.namedItem('watchos').value.trim(),appVersion:fields.namedItem('appVersion').value.trim(),notes:fields.namedItem('notes').value.trim(),
      checks:Object.fromEntries(NAVIGATION_CHECKS.map(c => [c.id,fields.namedItem(c.id).value]))};
  }
  function fill() {
    const draft=draftFor(workflow);fields.namedItem('workflow').value=workflow;
    for(const key of ['ios','watchos','appVersion','notes']) fields.namedItem(key).value=draft[key];
    for(const c of NAVIGATION_CHECKS) {
      fields.namedItem(c.id).value=draft.checks[c.id];
      container.querySelector(`[data-check="${c.id}"]`).hidden=!!c.gpxOnly && workflow !== 'easyroute';
    }
    const prior=findReport(workflow),state=navigationReportState(prior,route.review.geometryHash);
    container.querySelector('.device-check-state').textContent=`${state.text}${prior?.checkedAt ? ` · saved ${new Date(prior.checkedAt).toLocaleDateString('en-US',{timeZone:'America/New_York'})}` : ''}`;
    message.textContent=problem;
  }
  fields.namedItem('workflow').addEventListener('change',() => {drafts[workflow]=collect();workflow=fields.namedItem('workflow').value;fill();});
  form.addEventListener('submit',event => {
    event.preventDefault();
    try {
      const report=validateNavigationReports([{...collect(),checkedAt:new Date().toISOString()}])[0];
      const next=[...reports.filter(r => !(r.routeId === route.id && r.workflow === workflow)),report];
      validateNavigationReports(next);reports=next;drafts[workflow]=report;
      if(!blocked) {try {localStorage.setItem(STORAGE,JSON.stringify(reports));} catch {blocked=true;problem='Browser storage is unavailable. Export these device checks before closing.';}}
      fill();message.textContent=problem || 'Saved your observations in this browser. Other routes and workflows still need their own checks.';
    } catch(error) {message.textContent=error.message;}
  });
  container.querySelector('.device-check-export').addEventListener('click',() => exportReports(reports));
  fill();
}
