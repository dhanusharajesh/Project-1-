function loadArchivedTasks() {
    fetch('/api/tasks/archived')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('archived-task-container');
            container.innerHTML = '';
            data.tasks.forEach(task => {
                container.innerHTML += `
                    <div class="task-card">
                        <h3>${task.title}</h3>
                        <p>${task.descriptions}</p>
                        <p><strong>Status:</strong> ${task.status}</p>
                        <p><strong>Priority:</strong> ${task.priority}</p>
                        <p><strong>Assigned to:</strong> ${task.assigned_to_name}</p>
                        <p><strong>Due:</strong> ${task.due_date}</p>
                    </div>
                `;
            });
        });
}
document.addEventListener('DOMContentLoaded', () => {
    function loadCompanyName() {
        fetch('/api/company')
            .then(response => response.json())
            .then(data => {
                if (data && data.name) {
                    const companyNameEl = document.getElementById('companyName');
                    if (companyNameEl) {
                        companyNameEl.textContent = data.name;
                    }
                    const companyInputEl = document.getElementById('companyInput');
                    if (companyInputEl) {
                        companyInputEl.value = data.name;
                    }
                }
            })
            .catch(error => console.error('Error fetching company name:', error));
    }

    loadArchivedTasks();

    window.onload = function () {
     loadCompanyName();
    };
});
