const form = document.querySelector('#connection-form');
const input = document.querySelector('#server-url');
const button = document.querySelector('#connect-button');
const errorMessage = document.querySelector('#connection-error');

window.cashier.settings().then((settings) => {
    input.value = settings.server_url || 'http://127.0.0.1:8000';
    input.select();
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMessage.textContent = '';
    button.disabled = true;
    button.textContent = 'Connecting...';

    try {
        const connection = await window.cashier.setServerUrl(input.value);
        window.location.assign(connection.pos_url);
    } catch (error) {
        errorMessage.textContent = error?.message || 'Enter a valid server address.';
        button.disabled = false;
        button.textContent = 'Save and Reconnect';
        input.focus();
        input.select();
    }
});
