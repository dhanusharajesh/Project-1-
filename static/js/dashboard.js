document.addEventListener('DOMContentLoaded', () => {
  const taskListEl = document.getElementById('taskList');
  const statusFilter = document.getElementById('statusFilter');
  const priorityFilter = document.getElementById('priorityFilter');

  let allTasks = [];
  async function fetchTasks() {
    try {
      const showArchived = document.getElementById('archiveFilter')?.checked;
      const url = showArchived ? '/api/tasks?archived=true' : '/api/tasks';
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error('Network response was not ok');
      allTasks = data.tasks;
      renderTasks();
    } 
    catch (error) {
      taskListEl.innerHTML = '<p>Error loading tasks.</p>';
      console.error('Error fetching tasks:', error);
    }
  }
  function renderTasks() {
    taskListEl.innerHTML = '';

    const statusVal = statusFilter.value.toLowerCase();
    const priorityVal = priorityFilter.value.toLowerCase();

    const filteredTasks = allTasks.filter(task => {
      const taskStatus = (task.status || '').toLowerCase();
      const taskPriority = (task.priority || '').toLowerCase();
      return (statusVal === 'all' || taskStatus === statusVal) &&
            (priorityVal === 'all' || taskPriority === priorityVal);
    });

    if (filteredTasks.length === 0) {
      taskListEl.innerHTML = '<p>No tasks found</p>'; 
      return;
    }

    filteredTasks.forEach(task => { 
      const taskCard = document.createElement('div');
      taskCard.classList.add('task-card');

      const priority = (task.priority || '').toLowerCase();
      if (priority === 'high') {
        taskCard.classList.add('task-priority-high');
      } 
      else if (priority === 'medium') {
        taskCard.classList.add('task-priority-medium');
      } 
      else if (priority === 'low') {
        taskCard.classList.add('task-priority-low');
      }

      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';
      const overdueMsg = isOverdue ? `<div class="task-meta task-overdue">Task Overdue</div>` : '';

      let buttons = '';
      if (userRole === 'admin') {
        if (task.status !== 'Done') {
          buttons += `<button onclick="editTask(${task.id})">Edit</button>`;
        }
        else if (task.status === 'Done' && !task.approved) {
          buttons += `<button onclick="approveTask(${task.id})">Approve</button>`;
        }
        if (task.status === 'Done' && task.approved && !task.archived) {
          buttons += `<button onclick="archiveTask(${task.id})">Archive</button>`;
        }
        buttons += `<button onclick="deleteTask(${task.id})">Delete</button>`;
      }

      else if (userRole === 'team_member') {
        if (task.status === 'Done' && !task.approved) {
          buttons += `<button onclick="undoTask(${task.id})">Undo</button>`;
        } else if (task.status !== 'Done') {
          buttons += `<button onclick="markDone(${task.id})">Mark as Done</button>`;
        }
      }  
      taskCard.innerHTML = `
        <div class="task-title">${task.title}</div>
        <div class="task-meta">Description: ${task.descriptions}</div>
        <div class="task-meta">Status: ${task.status}</div>
        <div class="task-meta">Priority: ${task.priority}</div>
        <div class="task-meta">Due: ${task.due_date || 'N/A'}</div>
        <div class="task-meta">Assigned To: ${task.assigned_to_name || 'Unassigned'}</div>
        <div class="task-meta">Completed At: ${task.completed_at ? new Date(task.completed_at).toLocaleString() : 'Not completed yet'}</div>
        ${overdueMsg} 
        <div class="task-buttons">${buttons}</div>
      `;
      taskListEl.appendChild(taskCard);
    });
  }
  document.getElementById('addTaskBtn')?.addEventListener('click', () => openModal());

  async function populateUserDropdown(selectedUserId) {
    const select = document.getElementById('assigned_to');
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      select.innerHTML = '<option value="">Select User</option>';
      data.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username;
        if (user.id == selectedUserId) option.selected = true;
        select.appendChild(option);
      });
    } 
    catch (err) {
      console.error('Failed to load users:', err);
      select.innerHTML = '<option value="">Error loading users</option>';
    }
  }

  function openModal(task = null) {
    document.getElementById('taskModal').style.display = 'block';
    document.getElementById('modalTitle').textContent = task ? 'Edit Task' : 'Add Task';
    document.getElementById('taskId').value = task?.id || '';
    document.getElementById('title').value = task?.title || '';
    document.getElementById('descriptions').value = task?.descriptions || '';
    document.getElementById('status').value = task?.status || 'To Do';
    document.getElementById('priority').value = task?.priority || 'Low';
    document.getElementById('due_date').value = task?.due_date || '';
    document.getElementById('assigned_to').value = task?.assigned_to || '';

    const dueDateInput = document.getElementById('due_date');
    const today = new Date().toISOString().split('T')[0];
    dueDateInput.setAttribute('min', today);

    populateUserDropdown(task?.assigned_to || '');
  }

  function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
    document.getElementById('taskForm').reset();
  }

  document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const payload = {
      title: document.getElementById('title').value,
      descriptions: document.getElementById('descriptions').value,  
      status: document.getElementById('status').value,
      priority: document.getElementById('priority').value,
      due_date: document.getElementById('due_date').value || null,
      assigned_to: document.getElementById('assigned_to').value || null,
    };

    const url = id ? `/api/tasks/${id}` : '/api/tasks';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      closeModal();
      fetchTasks();
    } 
    else {
      alert('Failed to save task.');
    }
  });

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

  window.editTask = function (id) {
    const task = allTasks.find(t => t.id === id);
    if (task) openModal(task);
  };

  window.deleteTask = async function (id) {
    if (!confirm('Delete this task?')) return;
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchTasks();
    }
    else {
      alert('Failed to delete task.');
    }
  };

  window.markDone = function (id) {
    fetch(`/api/tasks/${id}/done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to mark task as done');
        return res.json();
      })
      .then(() => fetchTasks())
      .catch(err => {
        console.error('Error:', err);
        alert('Failed to mark task as done.');
      });
  };

  window.undoTask = function (id) {
    fetch(`/api/tasks/${id}/undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to undo task status');
        return res.json();
      })
      .then(() => fetchTasks())
      .catch(err => {
        console.error('Error:', err);
        alert('Failed to undo task status.');
      });
  };

  window.approveTask = function (id) {
    if (!confirm('Approve this task?')) return;

    fetch(`/api/tasks/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to approve task');
        return res.json();
      })
      .then(data => {
        alert(data.message || 'Task approved');
        fetchTasks(); 
      })
      .catch(err => {
        console.error('Error approving task:', err);
        alert('Failed to approve task.');
      });
  };

  window.archiveTask = async function (id) {
    if (!confirm('Archive this task?')) return;

    try {
      const res = await fetch(`/api/tasks/${id}/archive`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to archive task');
      fetchTasks(); 
    } catch (err) {
      console.error('Error archiving task:', err);
      alert('Failed to archive task.');
    }
  };

  window.onload = function () {
    loadCompanyName();
  };

  window.updateCompanyName = function () {
    const newName = document.getElementById('companyInput').value.trim();
    if (!newName) {
      alert('Company name cannot be empty');
      return;
    }

    fetch('/api/company', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newName })
    })
      .then(response => response.json())
      .then(data => {
        if (data.message) {
          alert(data.message);
          document.getElementById('companyInput').value = newName;
          document.getElementById('companyName').textContent = newName;
        } else if (data.error) {
          alert('Error: ' + data.error);
        }
      })
      .catch(error => alert('Request failed: ' + error));
  };
  document.getElementById('statusFilter').addEventListener('change', fetchTasks);
  document.getElementById('priorityFilter').addEventListener('change', fetchTasks);
  document.getElementById('archiveFilter')?.addEventListener('change', fetchTasks);

  fetchTasks();
});
