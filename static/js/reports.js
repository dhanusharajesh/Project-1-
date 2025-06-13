document.addEventListener('DOMContentLoaded', () => {
    if (userRole !== 'team_member') {
        document.getElementById('log-form').style.display = 'none';
    }

    let selectedTaskId = null;

    async function loadTasks() {
        try {
            const response = await fetch('/api/tasks');
            const data = await response.json();

            const grid = document.getElementById('tasks-grid');
            grid.innerHTML = '';

            data.tasks.forEach(task => {
                const card = document.createElement('div');
                card.classList.add('task-card');
                card.innerHTML = `
                    <h4>${task.title}</h4>
                    <p>${task.descriptions}</p>
                    <small>Due: ${
                        task.due_date && task.due_date.includes('T')
                          ? task.due_date.split('T')[0]
                          : task.due_date || 'N/A'
                    }</small>
                `;

                card.onclick = () => {
                    selectedTaskId = task.id;
                    document.getElementById('task-title').textContent = task.title;
                    document.getElementById('logs-section').style.display = 'block'; 

                    const dueDateDisplay = document.getElementById('due-date-display');
                    dueDateDisplay.textContent = task.due_date?.split('T')[0] || 'N/A';
                    resetForm();
                    loadLogs(task.id);
                };

                grid.appendChild(card);
            });
        } catch (error) {
            alert('Failed to load tasks');
            console.error(error);
        }
    }

    async function loadLogs(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/logs`);
            const logs = await response.json();

            const tbody = document.querySelector('#logs-table tbody');
            tbody.innerHTML = '';

            logs.forEach(log => {
                const tr = document.createElement('tr');

                tr.innerHTML = `
                    <td>${log.work_date}</td>
                    <td>${log.username}</td>
                    <td>${log.work_description}</td>
                    <td><span class="log-status ${log.status}">${log.status}</span></td>
                    <td>${log.admin_comment || ''}</td>
                    <td></td>
                `;

                const deleteTd = tr.querySelector('td:last-child');
                if (userRole === 'team_member'&& log.status === 'Pending') {
                    const editBtn = document.createElement('button');
                    editBtn.textContent = 'Edit';
                    editBtn.classList.add('edit-log-btn');
                    editBtn.onclick = () => {
                        const newDesc = prompt('Edit your work description:', log.work_description);
                        if (newDesc && newDesc.trim() !== '') {
                            updateLogDescription(log.id, newDesc.trim());
                        }
                    };
                    deleteTd.appendChild(editBtn);
                }

                if (userRole === 'admin' && log.status === 'Pending') {
                    const reviewTd = tr.children[4];
                    const div = document.createElement('div');
                    div.classList.add('review-section');  

                    const commentArea = document.createElement('textarea');
                    commentArea.placeholder = 'Admin comment';
                    commentArea.id = `admin-comment-${log.id}`;

                    const approveBtn = document.createElement('button');
                    approveBtn.textContent = 'Approve';
                    approveBtn.onclick = () => reviewLog(log.id, 'Approved', commentArea.value);

                    const rejectBtn = document.createElement('button');
                    rejectBtn.textContent = 'Reject';
                    rejectBtn.classList.add('reject');
                    rejectBtn.onclick = () => reviewLog(log.id, 'Rejected', commentArea.value);

                    div.appendChild(commentArea);
                    div.appendChild(approveBtn);
                    div.appendChild(rejectBtn);
                    reviewTd.appendChild(div);
                }

                tbody.appendChild(tr);
            });
        } catch (error) {
            alert('Failed to load logs');
            console.error(error);
        }
    }
    async function updateLogDescription(logId, newDescription) {
        try {
            const response = await fetch(`/api/daily_logs/${logId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ work_description: newDescription })
            });

            const result = await response.json();
            if (response.ok) {
                alert('Log updated successfully');
                loadLogs(selectedTaskId);
            } else {
                alert(result.error || 'Failed to update log');
            }
        } catch (error) {
            alert('Error updating log');
            console.error(error);
        }
    }

    document.getElementById('log-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedTaskId) {
            alert('Select a task first');
            return;
        }

        const work_date = document.getElementById('work_date').value;
        const work_description = document.getElementById('work_description').value;
        const status = document.getElementById('status')?.value || 'Pending';

        if (!work_date || !work_description) {
            alert('Please fill in all fields correctly');
            return;
        }
        try {
            const response = await fetch('/api/daily_logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: selectedTaskId,
                    work_date,
                    work_description,
                    status
                })
            });

            const result = await response.json();
            if (response.ok) {
                alert('Daily log submitted successfully');
                loadLogs(selectedTaskId);
                resetForm();
            } else {
                alert(result.error || 'Failed to submit log');
            }
        } catch (error) {
            alert('Error submitting log');
            console.error(error);
        }
    });

    async function reviewLog(logId, status, adminComment) {
        try {
            const response = await fetch(`/api/daily_logs/${logId}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, admin_comment: adminComment })
            });

            const result = await response.json();
            if (response.ok) {
                alert(`Log ${status.toLowerCase()} successfully`);
                loadLogs(selectedTaskId);
            } else {
                alert(result.error || 'Failed to update log status');
            }
        } catch (error) {
            alert('Error updating log status');
            console.error(error);
        }
    }

    function resetForm() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('log-form').reset();
        document.getElementById('work_date').value = today;

        const statusSelect = document.getElementById('status');
        if (statusSelect) {
            statusSelect.value = 'Pending';
        }
    }

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

    loadTasks();

    const workDateInput = document.getElementById('work_date');
    if (workDateInput) {
        const today = new Date().toISOString().split('T')[0];
        workDateInput.setAttribute('min', today);
    }

    window.onload = function () {
    loadCompanyName();
  };
});
