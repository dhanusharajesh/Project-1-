from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
import mysql.connector
from mysql.connector import Error  
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your_secret_key'

try:
    db = mysql.connector.connect(
        host="localhost",  
        user="root",
        password="Ammu@2005",
        database="scrum_board", 
        connection_timeout=5,
        use_pure=True,
    )
    print("MySQL connection successful")
    cursor = db.cursor(dictionary=True) 
except Error as e: 
    print("Error connecting to MySQL:", e)

def get_company_name():
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT name FROM company LIMIT 1")  
    result = cursor.fetchone()
    cursor.close()                                                   
    return result['name'] if result else 'Company'

@app.route('/')
def home():
    if session.get('username'):                  
        return redirect(url_for('dashboard'))  
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    if cursor and db.is_connected():
        cursor.execute("SELECT * FROM users WHERE username = %s AND password = %s", (username, password))
        user = cursor.fetchone()
    else:
        flash("Database connection error", "error")
        return redirect(url_for('home'))
    if user:
        session['username'] = user['username']
        session['user_id'] = user['id']
        session['role'] = user['role']
        return redirect(url_for('dashboard')) 
    else:
        flash("Invalid username or password", "error") 
        return redirect(url_for('home'))

@app.route('/dashboard')
def dashboard():
    if not session.get('username'):
        flash("Please log in to access the dashboard", "warning")
        return redirect(url_for('home'))

    tasks = []
    projects = []
    role = session.get('role')
    user_id = session.get('user_id') 

    if db.is_connected():
        cursor = db.cursor(dictionary=True)

        if role == 'admin':
            cursor.execute("""
                SELECT t.*, p.project_name 
                FROM tasks t
                LEFT JOIN projects p ON t.project_id = p.id
                LEFT JOIN users u ON t.assigned_to = u.id
            """)   
            tasks = cursor.fetchall()
        else:
            cursor.execute("""
                SELECT t.*, p.project_name 
                FROM tasks t
                LEFT JOIN projects p ON t.project_id = p.id
                WHERE t.assigned_to = %s 
            """, (user_id,))
            tasks = cursor.fetchall()

        cursor.execute("SELECT * FROM projects")
        projects = cursor.fetchall()

        cursor.close() 
    else:
        flash("Database connection error", "error")

    return render_template('dashboard.html', username=session['username'], tasks=tasks, projects=projects, role=role)

@app.route('/reports')
def reports_page():
    if not session.get('username'):
        flash("Please log in to access reports", "warning")
        return redirect(url_for('home'))
    
    return render_template('reports.html', username=session['username'], role=session['role'])

@app.route('/api/tasks')
def api_tasks():
    if not session.get('username'):
        return jsonify({"error": "Unauthorized"}), 401

    role = session.get('role')
    user_id = session.get('user_id')  

    if cursor and db.is_connected():
        if role == 'admin':
            cursor.execute("""
                SELECT t.*, u.username AS assigned_to_name
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.deleted = 0 AND t.archived = 0
                ORDER BY t.due_date ASC
            """)
        else:
            cursor.execute("""
                SELECT t.*, u.username AS assigned_to_name
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.assigned_to = %s AND t.deleted = 0 AND t.archived = 0
                ORDER BY t.due_date ASC
            """, (user_id,))
        tasks = cursor.fetchall() 
        return jsonify({"tasks": tasks})
    
    else:
        return jsonify({"error": "Database connection error"}), 500
    
@app.route('/api/company', methods=['GET'])
def get_company():
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT name FROM company LIMIT 1")
        result = cursor.fetchone() 
        cursor.close()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/company', methods=['POST'])
def update_company():
    if 'role' not in session or session['role'] != 'superadmin':
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        data = request.get_json()
        new_name = data.get('name')

        cursor = db.cursor()
        cursor.execute("UPDATE company SET name = %s WHERE id = 1", (new_name,))
        db.commit()
        cursor.close()
        return jsonify({'message': 'Company name updated'}), 200     
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>/done', methods=['POST'])
def mark_task_done(task_id):
    if not session.get('username'):
        return jsonify({"error": "Unauthorized"}), 401

    role = session.get('role')
    user_id = session.get('user_id')

    try:
        if db.is_connected():
            cursor = db.cursor(dictionary=True)
            completed_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            if role == 'admin':
                cursor.execute("UPDATE tasks SET status = 'Done', completed_at = %s WHERE id = %s", (completed_at,task_id))
            else:
                cursor.execute("UPDATE tasks SET status = 'Done', completed_at = %s WHERE id = %s AND assigned_to = %s", (completed_at,task_id, user_id))

            if cursor.rowcount == 0:
                return jsonify({"error": "Task not found or not authorized"}), 403

            db.commit() 
            return jsonify({"message": "Task marked as done"}), 200
        else:
            return jsonify({"error": "Database connection error"}), 500
    except Error as e:
        print("Error updating task:", e)
        return jsonify({"error": "Failed to update task"}), 500
    
@app.route('/api/tasks/<int:task_id>/undo', methods=['POST'])
def undo_task_done(task_id):
    if not session.get('username'):
        return jsonify({"error": "Unauthorized"}), 401

    role = session.get('role')
    user_id = session.get('user_id')

    try:
        if db.is_connected():
            cursor = db.cursor(dictionary=True)

            if role == 'admin':
                cursor.execute("""
                    UPDATE tasks 
                    SET status = 'To Do', completed_at = NULL 
                    WHERE id = %s
                """, (task_id,))
            else:
                cursor.execute("""
                    UPDATE tasks 
                    SET status = 'To Do', completed_at = NULL 
                    WHERE id = %s AND assigned_to = %s
                """, (task_id, user_id))

            if cursor.rowcount == 0:
                return jsonify({"error": "Task not found or not authorized"}), 403

            db.commit()
            cursor.close()
            return jsonify({"message": "Task reverted to To Do"}), 200
        else:
            return jsonify({"error": "Database connection error"}), 500
    except Error as e:
        print("Error undoing task:", e)
        return jsonify({"error": "Failed to undo task"}), 500
    
@app.route('/api/tasks/<int:task_id>/approve', methods=['POST'])
def approve_task(task_id):
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM tasks WHERE id = %s", (task_id,))
        task = cursor.fetchone()
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        cursor.execute("UPDATE tasks SET approved = 1 WHERE id = %s", (task_id,))
        db.commit()
        return jsonify({'message': 'Task approved successfully'})
    except Exception as e:
        print("Error in approve_task():", e)
        return jsonify({'error': 'Failed to approve task'}), 500
    
@app.route('/archived')
def archived_tasks_page():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect(url_for('login'))
    return render_template('archived_tasks.html', username=session['username'])
    
@app.route('/api/tasks/<int:task_id>/archive', methods=['POST'])
def archive_task(task_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        cursor = db.cursor()
        cursor.execute("SELECT status FROM tasks WHERE id = %s", (task_id,))
        task = cursor.fetchone()
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        if task[0] != 'Done':
            return jsonify({'error': 'Only tasks marked as Done can be archived'}), 400

        cursor.execute("UPDATE tasks SET archived = 1 WHERE id = %s", (task_id,))
        db.commit()
        cursor.close()
        return jsonify({'message': 'Task archived successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/archived')
def api_archived_tasks():
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("""
            SELECT t.*, u.username AS assigned_to_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.deleted = 0 
            AND t.archived = 1
            ORDER BY t.completed_at DESC
        """)
        archived_tasks = cursor.fetchall()
        cursor.close()
        return jsonify({'tasks': archived_tasks})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks', methods=['POST'])
def create_task():
    if not session.get('username'):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    title = data.get('title')
    descriptions = data.get('descriptions')  
    status = data.get('status')
    priority = data.get('priority')
    due_date = data.get('due_date')
    user_id = session.get('user_id')
    assigned_to = data.get('assigned_to')

    try:
        cursor.execute("""
            INSERT INTO tasks (title, descriptions, status, priority, due_date, user_id, assigned_to)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (title, descriptions, status, priority, due_date, user_id, assigned_to))
        db.commit()
        return jsonify({"message": "Task created successfully"}), 201
    except Error as e:
        print("Error creating task:", e)
        return jsonify({"error": "Failed to create task"}), 500

@app.route('/api/tasks/<int:id>', methods=['PUT'])
def update_task(id):
    if not session.get('username'):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    title = data.get('title')
    descriptions = data.get('descriptions')  
    status = data.get('status')
    priority = data.get('priority')
    due_date = data.get('due_date')
    assigned_to = data.get('assigned_to')

    try:
        cursor.execute("""
            UPDATE tasks 
            SET title = %s, descriptions = %s, status = %s, priority = %s, due_date = %s, assigned_to = %s
            WHERE id = %s
        """, (title, descriptions, status, priority, due_date, assigned_to, id))
        db.commit()
        return jsonify({"message": "Task updated successfully"}), 200
    except Error as e:
        print("Error updating task:", e)
        return jsonify({"error": "Failed to update task"}), 500

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        cursor = db.cursor()
        cursor.execute("SELECT archived FROM tasks WHERE id = %s AND deleted = 0", (task_id,))
        task = cursor.fetchone()
        if not task:
            return jsonify({'error': 'Task not found or already deleted'}), 404

        cursor.execute("UPDATE tasks SET deleted = 1 WHERE id = %s", (task_id,))
        db.commit()
        cursor.close()
        return jsonify({'message': 'Task deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/tasks/<int:task_id>/logs', methods=['GET'])
def get_task_logs(task_id):
    if not session.get('username'):
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("""
            SELECT dl.*, u.username
            FROM daily_logs dl
            JOIN users u ON dl.user_id = u.id
            WHERE dl.task_id = %s
            ORDER BY dl.work_date DESC
        """, (task_id,))
        logs = cursor.fetchall()
        cursor.close()
        return jsonify(logs)
    except Error as e:
        print("Error fetching logs:", e)
        return jsonify({'error': 'Failed to fetch logs'}), 500
    
@app.route('/api/daily_logs', methods=['POST'])
def submit_daily_log():
    if not session.get('username'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    if session.get('role') != 'team_member':
        return jsonify({'error': 'Only team members can submit logs'}), 403

    data = request.get_json()
    task_id = data.get('task_id')
    work_date = data.get('work_date')
    work_description = data.get('work_description')

    try:
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO daily_logs (task_id, user_id, work_date, work_description, status)
            VALUES (%s, %s, %s, %s, 'Pending')
        """, (task_id, session['user_id'], work_date, work_description))
        db.commit()
        cursor.close()
        return jsonify({'message': 'Daily log submitted'}), 200
    except Error as e:
        print("Error submitting log:", e)
        return jsonify({'error': 'Failed to submit log'}), 500

@app.route('/api/daily_logs/<int:log_id>/review', methods=['POST'])
def review_log(log_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    status = data.get('status')
    admin_comment = data.get('admin_comment', '')

    try:
        cursor = db.cursor()
        cursor.execute("""
            UPDATE daily_logs 
            SET status = %s, admin_comment = %s
            WHERE id = %s
        """, (status, admin_comment,log_id))
        db.commit()
        cursor.close()
        return jsonify({'message': 'Log status updated'}), 200
    except Error as e:
        print("Error reviewing log:", e)
        return jsonify({'error': 'Failed to update log status'}), 500

@app.route('/api/daily_logs/<int:log_id>', methods=['PUT'])
def update_daily_log(log_id):
    data = request.get_json()
    work_description = data.get('work_description')

    if not work_description:
        return jsonify({'error': 'Description is required'}), 400

    try:
        cursor = db.cursor()
        cursor.execute("UPDATE daily_logs SET work_description = %s WHERE id = %s", (work_description, log_id))
        db.commit()
        cursor.close()
        return jsonify({'message': 'Log updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/users')
def get_users():
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username FROM users WHERE role = 'team_member'")
    users = cursor.fetchall()
    return jsonify(users)

@app.route('/logout')
def logout():
    session.pop('username', None)
    session.pop('user_id', None)
    session.pop('role', None)
    flash("You have been logged out", "info")
    return redirect(url_for('home'))

if __name__ == '__main__':
    app.run(debug=True)