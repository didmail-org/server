import { renderMemberAccess } from './member-access.js';
import { escapeHtml as e, request, didMarkup } from './shared.js';

export function renderMailPolicy(snapshot, list, transport, t, activeTab = 'service', area = 'all') {
  if (area === 'members') return renderMemberAccess(snapshot,list,t);
  const p = snapshot.policy;
  const arcMembers = snapshot.accessSource === 'arc';
  const field = (label, name, value, min, max) =>
    `<label>${e(t(label))}<input name="${name}" type="number" min="${min}" max="${max}" step="1" required value="${e(value)}"></label>`;
  const check = (label, name, checked, disabled = false) =>
    `<label class="dm-toggle"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}> ${e(t(label))}</label>`;
  const tabs = [['service', 'Mail service'], ['access', 'DID access lists'], ['operations', 'Delivery operations']].filter(([id]) => area === 'all' || (area === 'members' ? id === 'access' : id !== 'access'));
  if (!tabs.some(([id]) => id === activeTab)) activeTab = tabs[0][0];
  const tabPanel = (id) => area === 'members' ? `data-settings-panel="${id}"` : `id="settings-${id}-panel" role="tabpanel" tabindex="0" aria-labelledby="settings-${id}-tab" data-settings-panel="${id}" ${activeTab === id ? '' : 'hidden'}`;
  const accessControl = `      <fieldset class="dm-settings-section"><legend>${e(t('Sending access'))}</legend><div class="dm-form-grid">
      <label>${e(t('Sending access'))}<select name="accessMode"><option value="public" ${p.accessMode === 'public' ? 'selected' : ''}>${e(t('All senders except denylist'))}</option><option value="allowlist" ${p.accessMode === 'allowlist' ? 'selected' : ''}>${e(t(arcMembers ? 'Active ARC members only' : 'Allowlist only'))}</option></select></label>
      <p class="dm-muted">${e(t(arcMembers ? 'Denylist takes priority. Members-only sending requires an active linked ARC member.' : 'Denylist takes priority. An empty allowlist blocks new sends in allowlist-only mode.'))}</p>
      </div></fieldset>`;
  return `<div class="dm-row"><h2>${e(t(area === 'members' ? 'DID access lists' : 'Mail service'))}</h2><button type="button" data-policy-action="refresh" class="dm-secondary">${e(t('Refresh'))}</button></div>
    ${area !== 'settings' ? `<p class="dm-muted">${e(t('Access lists control who can send and store mail here. External recipients can still download their mail.'))}</p>` : ''}
    <p data-policy-notice role="status"></p>
    ${area === 'members' ? '' : `<div class="dm-settings-tabs" role="tablist" aria-label="${e(t('Settings'))}">${tabs.map(([id, label]) => `<button type="button" role="tab" id="settings-${id}-tab" aria-controls="settings-${id}-panel" aria-selected="${activeTab === id}" tabindex="${activeTab === id ? '0' : '-1'}" data-settings-tab="${id}">${e(t(label))}</button>`).join('')}</div>`}
    ${area === 'members' ? '' : `<div ${tabPanel('service')}><form data-service-policy>
      ${area === 'all' ? accessControl : ''}<fieldset class="dm-settings-section"><legend>${e(t('New mail attachment limits'))}</legend>
      ${check('Allow attachments', 'attachmentsEnabled', p.attachments.enabled)}
      <div class="dm-form-grid">${field('Maximum attachment count', 'maxCount', p.attachments.maxCount, 0, 20)}
      ${field('Maximum file bytes', 'maxFileBytes', p.attachments.maxFileBytes, 1, 67108864)}
      ${field('Maximum total attachment bytes', 'maxTotalBytes', p.attachments.maxTotalBytes, 1, 67108864)}
      ${field('Maximum encrypted message bytes', 'maxMessageBytes', p.maxMessageCiphertextBytes, 16, 67108864)}
      </div><p class="dm-muted">${e(t('File limits count plaintext bytes; the message limit includes encryption overhead. Accepted mail keeps its existing terms.'))}</p>
      <p class="dm-muted">${e(t('The node and sender must each maintain the required native-token gas stake. Downloading requires no stake.'))}</p>
      </fieldset><div class="dm-settings-save"><button type="submit">${e(t('Save mail service policy'))}</button></div>
    </form></div>`}${area === 'settings' ? '' : `<div ${tabPanel('access')}>
      ${area === 'members' ? `<form data-member-access>${accessControl}<button type="submit">${e(t('Save sending access'))}</button></form>` : ''}
      ${area === 'members' ? '' : `<h3>${e(t('DID access lists'))}</h3>`}
      ${arcMembers ? `<p><a href="/.well-known/service/admin">${e(t('Manage ARC members and invitations'))}</a></p>` : ''}
      <label>${e(t('List'))}<select data-policy-kind>${arcMembers ? '' : `<option value="allow" ${list.kind === 'allow' ? 'selected' : ''}>${e(t('Allowlist'))}</option>`}<option value="deny" ${list.kind === 'deny' ? 'selected' : ''}>${e(t('Denylist'))}</option></select></label>
      <form data-access-entry class="dm-access-form"><label>DID<input name="did" placeholder="did:abt:…" pattern="did:abt:z[1-9A-HJ-NP-Za-km-z]{20,64}" maxlength="72" required></label><label>${e(t('Remark'))}<input name="remark" maxlength="500"></label><button type="submit">${e(t('Add or update remark'))}</button></form>
      <p class="dm-muted">${e(t('List changes do not automatically change the access mode.'))}</p>
      <div class="dm-table-wrap"><table><thead><tr><th>DID</th><th>${e(t('Remark'))}</th><th>${e(t('Added at'))}</th><th>${e(t('Action'))}</th></tr></thead><tbody>${list.entries.map((row) => `<tr><td>${didMarkup(row.did, t)}</td><td>${e(row.remark)}</td><td>${e(row.createdAt)}</td><td><button type="button" data-policy-action="remove" data-did="${e(row.did)}" class="dm-secondary">${e(t('Remove from list'))}</button></td></tr>`).join('')}</tbody></table></div>
      ${!list.entries.length ? `<p>${e(t('No DIDs in this list.'))}</p>` : ''}
      <div class="dm-actions"><button type="button" data-policy-action="previous" ${list.hasPrevious ? '' : 'disabled'}>${e(t('Previous'))}</button><button type="button" data-policy-action="next" ${list.nextCursor ? '' : 'disabled'}>${e(t('Next'))}</button></div>
    </div>`}${area === 'members' ? '' : `<div ${tabPanel('operations')}>${transport.health ? `<div data-mail-health><h3>${e(t('Delivery operations'))}</h3><p>${transport.health.queues.map((row) => `${e(row.state)}: ${e(row.count)}`).join(' · ')}</p><div class="dm-table-wrap"><table><thead><tr><th>${e(t('Message'))}</th><th>${e(t('Status'))}</th><th>${e(t('Action'))}</th></tr></thead><tbody>${transport.health.attention.map((row) => `<tr><td><code>${e(row.messageId)}</code></td><td>${e(row.state)}<br>${e(row.problem?.code || '')}</td><td>${e(row.problem?.recoveryAction || 'query_status')}</td></tr>`).join('')}</tbody></table></div><p class="dm-muted">${e(t('Paid delivery failures require operator reconciliation. Review the original payment before any refund.'))}</p></div>` : `<p class="dm-empty">${e(t('Delivery status is unavailable. Refresh to try again.'))}</p>`}</div>`}`;
}

export async function mountMailPolicy(parent, t, area = 'settings') {
  const panel = document.createElement('section');
  panel.className = area === 'members' ? 'dm-member-access-body' : 'dm-card';
  panel.dataset.mailPolicyPanel = '';
  if (area === 'members') {
    const section = document.createElement('details');
    section.className = 'dm-card dm-member-access';
    section.innerHTML = `<summary>${e(t('Blocked senders'))}</summary>`;
    section.append(panel);
    parent.prepend(section);
  } else parent.prepend(panel);
  let snapshot,
    transport,
    list,
    kind = 'allow',
    after = '',
    history = [],
    busy = false,
    activeTab = area === 'members' ? 'access' : 'service',
    policyDirty = false;
  const notify = (message, error = false) => {
    const target = panel.querySelector('[data-policy-notice]');
    if (target) {
      target.textContent = message;
      target.setAttribute('role', error ? 'alert' : 'status');
    }
  };
  const load = async () => {
    const form = panel.querySelector('[data-service-policy]');
    const draft = policyDirty && form ? [...form.elements].filter((input) => input.name && (input.type !== 'radio' || input.checked)).map((input) => ({ name: input.name, value: input.value, checked: input.checked })) : null;
    const result = await Promise.all([
      request('/api/admin/mail-policy'),
      area === 'members' ? request(`/api/admin/mail-access-list?kind=${kind}&limit=50${after ? '&after=' + encodeURIComponent(after) : ''}`) : Promise.resolve({entries:[],kind}),
      Promise.resolve({transportEnabled:false}),
      area === 'members' ? Promise.resolve(null) : request('/api/admin/mail-health').catch(() => null),
    ]);
    if (!panel.isConnected) return;
    [snapshot, list, transport] = result;
    if (area === 'members' && snapshot.accessSource === 'arc' && kind !== 'deny') {
      kind = 'deny'; after = ''; history = [];
      list = await request('/api/admin/mail-access-list?kind=deny&limit=50');
      if (!panel.isConnected) return;
    }
    transport = { ...transport, health: result[3] && Array.isArray(result[3].queues) && Array.isArray(result[3].attention) ? result[3] : undefined };
    panel.innerHTML = renderMailPolicy(snapshot, { ...list, hasPrevious: history.length > 0 }, transport, t, activeTab, area);
    if (draft) for (const input of draft) {
      const target = panel.querySelector('[data-service-policy]').elements.namedItem(input.name);
      target.value = input.value;
      if (target.type === 'checkbox') target.checked = input.checked;
    }
  };
  const run = async (action) => {
    if (busy) return;
    busy = true;
    panel.querySelectorAll('button').forEach((button) => {
      button.disabled = true;
    });
    try {
      await action();
    } catch (error) {
      notify(
        t(
          error.status === 409
            ? 'Policy changed or is unavailable. Refresh and review before retrying.'
            : area === 'members'
              ? error.status === 400 ? 'Enter a valid mailbox or ARC DID.' : 'Could not confirm the result. Refresh the list before retrying.'
              : error.message,
        ),
        true,
      );
    } finally {
      busy = false;
      panel.querySelectorAll('button').forEach((button) => {
        button.disabled =
          button.dataset.policyAction === 'previous'
            ? !history.length
            : button.dataset.policyAction === 'next'
              ? !list?.nextCursor
              : false;
      });
    }
  };
  panel.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const form = event.target,
      values = Object.fromEntries(new FormData(form));
    void run(async () => {
      let message = 'Mail service settings saved.';
      if (form.matches('[data-service-policy]')) {
        const policy = structuredClone(snapshot.policy);
        if (values.accessMode !== undefined) policy.accessMode = values.accessMode;
        if (form.matches('[data-service-policy]')) {
          // VC delivery is retired; retain historical terms without exposing controls.
          policy.ordinary.enabled = false;
          policy.attachments = {
            enabled: values.attachmentsEnabled === 'on',
            maxCount: Number(values.maxCount),
            maxFileBytes: Number(values.maxFileBytes),
            maxTotalBytes: Number(values.maxTotalBytes),
          };
          policy.maxMessageCiphertextBytes = Number(values.maxMessageBytes);
        }

        await request('/api/admin/mail-policy', {
          method: 'PUT',
          body: { expectedRevision: snapshot.revision, policy },
        });
        policyDirty = false;
      } else {
        const raw = values.did.trim();
        const did = raw.startsWith('z') ? 'did:abt:' + raw : raw;
        const editing = form.elements.namedItem('did').readOnly;
        message = editing ? 'Note updated.' : kind === 'deny' ? 'Sender blocked.' : 'Sender allowed.';
        await request('/api/admin/mail-access-list', {
          method: 'PUT',
          body: { expectedRevision: snapshot.revision, kind, did, remark: values.remark },
        });
      }
      after = '';
      history = [];
      await load();
      notify(t(message));
    });
  });
  panel.addEventListener('input', (event) => {
    if (event.target.closest('[data-service-policy]')) { policyDirty = true; }
  });
  panel.addEventListener('change', (event) => {
    if (event.target.closest('[data-service-policy]')) { policyDirty = true; }
    if (event.target.matches('[data-policy-kind]'))
      void run(async () => {
        kind = event.target.value;
        after = '';
        history = [];
        await load();
      });
  });
  const selectTab = (tab, focus = false) => {
    activeTab = tab.dataset.settingsTab;
    panel.querySelectorAll('[data-settings-tab]').forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    panel.querySelectorAll('[data-settings-panel]').forEach((item) => {
      item.hidden = item.dataset.settingsPanel !== activeTab;
    });
    if (focus) tab.focus();
  };
  panel.addEventListener('keydown', (event) => {
    const tab = event.target.closest('[data-settings-tab]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...panel.querySelectorAll('[data-settings-tab]')];
    const direction = getComputedStyle(panel).direction === 'rtl' ? -1 : 1;
    const step = (event.key === 'ArrowRight' ? 1 : -1) * direction;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + step + tabs.length) % tabs.length;
    selectTab(tabs[index], true);
  });
  panel.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-settings-tab]');
    if (tab) {
      event.preventDefault();
      event.stopPropagation();
      selectTab(tab);
      return;
    }
    const button = event.target.closest('[data-policy-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (['edit-entry','cancel-entry'].includes(button.dataset.policyAction)) {
      const editor = panel.querySelector('[data-block-editor]'), form = editor.querySelector('form');
      form.reset();
      const editing = button.dataset.policyAction === 'edit-entry';
      form.elements.namedItem('did').readOnly = editing;
      if (editing) {
        form.elements.namedItem('did').value = button.dataset.did;
        form.elements.namedItem('remark').value = button.dataset.remark;
        form.querySelector('[data-entry-submit]').textContent = t('Save note');
      } else form.querySelector('[data-entry-submit]').textContent = t(kind === 'deny' ? 'Confirm block' : 'Confirm allow');
      editor.querySelector('summary').textContent = editing ? t('Edit note') : '+ ' + t(kind === 'deny' ? 'Block a sender' : 'Allow a sender');
      editor.open = editing;
      if (editing) form.elements.namedItem('remark').focus();
      return;
    }
    void run(async () => {
      if (button.dataset.policyAction === 'remove') {
        await request('/api/admin/mail-access-list', {
          method: 'DELETE',
          body: { expectedRevision: snapshot.revision, kind, did: button.dataset.did },
        });
        after = '';
        history = [];
      } else if (button.dataset.policyAction === 'next') {
        history.push(after);
        after = list.nextCursor;
      } else if (button.dataset.policyAction === 'previous') after = history.pop() || '';
      else {
        after = '';
        history = [];
      }
      await load();
      if (button.dataset.policyAction === 'remove') notify(t(kind === 'deny' ? 'Sender unblocked.' : 'Sender removed from allowlist.'));
    });
  });
  panel.innerHTML = `${area === 'members' ? '' : `<h2>${e(t('Mail service'))}</h2>`}<p data-policy-notice role="status">${e(t(area === 'members' ? 'Loading sender list…' : 'Loading mail service policy…'))}</p><button type="button" data-policy-action="refresh">${e(t('Retry'))}</button>`;
  await run(load);
}
