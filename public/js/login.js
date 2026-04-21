document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('login-alert');
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    alertBox.className = 'alert-message';
    alertBox.innerText = 'Autenticando...';
    alertBox.style.display = 'block';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('quantum_token', result.token);
            alertBox.classList.add('alert-success');
            alertBox.innerText = 'Acceso Concedido';
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 500);
        } else {
            alertBox.classList.add('alert-error');
            alertBox.innerText = result.message || 'Credenciales Inválidas';
        }
    } catch (err) {
        alertBox.classList.add('alert-error');
        alertBox.innerText = 'Error de conexión';
    }
});
