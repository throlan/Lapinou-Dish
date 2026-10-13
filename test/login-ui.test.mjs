import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
const start = source.indexOf("$('#login-form').addEventListener('submit',");
const end = source.indexOf('\ninit();', start);
assert.ok(start >= 0 && end > start, 'application login handler is present');
const loginHandler = source.slice(start, end);

function setupLogin() {
  const form = new EventTarget();
  form.elements = { password: { value: 'synthetic-test-password' } };
  let resetCount = 0, closeCount = 0, initCount = 0, completion;
  form.reset = () => { resetCount++; form.elements.password.value = ''; };
  const register = form.addEventListener.bind(form);
  form.addEventListener = (type, handler) => register(type, (event) => { completion = handler(event); });
  const message = { textContent: 'Previous error' };
  const dialog = { close() { closeCount++; } };
  let resolveLogin, rejectLogin, request;
  const pending = new Promise((resolve, reject) => { resolveLogin = resolve; rejectLogin = reject; });
  runInNewContext(loginHandler, {
    $: (selector) => ({ '#login-form': form, '#login-message': message, '#login-dialog': dialog })[selector],
    api: (path, options) => { request = { path, options }; return pending; },
    showMessage: (target, text) => { target.textContent = text; },
    init: async () => { initCount++; },
  });
  const event = new Event('submit', { cancelable: true });
  form.dispatchEvent(event);
  assert.equal(event.currentTarget, null, 'event target is released after synchronous dispatch');
  assert.equal(event.defaultPrevented, true);
  assert.equal(message.textContent, '', 'a new attempt clears the previous error');
  return {
    request, message,
    counts: () => ({ resetCount, closeCount, initCount }),
    async succeed() { resolveLogin({ authenticated: true }); await completion; },
    async fail(error) { rejectLogin(error); await completion; },
  };
}

test('successful asynchronous login closes the dialog and initializes without a reload', async () => {
  const login = setupLogin();
  assert.equal(login.request.path, '/api/login');
  assert.equal(login.request.options.method, 'POST');
  assert.deepEqual(JSON.parse(login.request.options.body), { password: 'synthetic-test-password' });
  await login.succeed();
  assert.deepEqual(login.counts(), { resetCount: 1, closeCount: 1, initCount: 1 });
  assert.equal(login.message.textContent, '');
});

test('invalid password keeps the login dialog and displays the password error', async () => {
  const login = setupLogin();
  await login.fail(Object.assign(new Error('invalid-password'), { body: { error: 'invalid-password' } }));
  assert.deepEqual(login.counts(), { resetCount: 0, closeCount: 0, initCount: 0 });
  assert.equal(login.message.textContent, 'Mot de passe incorrect.');
});

test('failed login request keeps the dialog and displays the connection error', async () => {
  const login = setupLogin();
  await login.fail(new Error('Network unavailable'));
  assert.deepEqual(login.counts(), { resetCount: 0, closeCount: 0, initCount: 0 });
  assert.equal(login.message.textContent, 'Connexion impossible. Vérifie que le service est prêt.');
});
