document.addEventListener('DOMContentLoaded', function() {
  const form = document.querySelector('form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  form.addEventListener('submit', function(event) {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    let errors = [];

    if (!username) {
      errors.push("Please enter username");
    }
    if (!password) {
      errors.push("Please enter password");
    }

    if (errors.length > 0) {
      event.preventDefault();
      alert(errors.join("\n"));
    }
  });

  document.getElementById('showPassword')?.addEventListener('change', function() {
    if(this.checked) {
      passwordInput.type = 'text';
    } else {
      passwordInput.type = 'password';
    }
  });
});
