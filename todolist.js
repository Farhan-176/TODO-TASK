 // --- DOM Elements ---
 const columns = document.querySelectorAll('.kanban-column');
 const addTaskBtn = document.getElementById('addTaskBtn');
 const newTaskInput = document.getElementById('newTaskInput');
 const deleteConfirmModal = document.getElementById('deleteConfirmModal');
 const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
 const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
 const editWarningNotification = document.getElementById('editWarningNotification');


 // --- State ---
 let tasks = [];
 let draggedTask = null;
 let originalTaskText = '';
 let taskToDeleteId = null; // Store ID of task pending deletion
 let notificationTimeout = null; // To manage the notification timer

 // --- Functions ---

 function generateId() {
     return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
 }

 /**
  * Creates the HTML element for a task card.
  * @param {object} task - The task object { id, text, column }.
  * @returns {HTMLElement} The task card div element.
  */
 function createTaskElement(task) {
     const taskCard = document.createElement('div');
     taskCard.classList.add('task-card', 'bg-gray-50', 'rounded-md', 'shadow', 'border', 'border-gray-200');
     taskCard.setAttribute('draggable', 'true');
     taskCard.setAttribute('data-task-id', task.id);

     const taskTextElement = document.createElement('span');
     taskTextElement.classList.add('task-text');
     taskTextElement.textContent = task.text;
     taskTextElement.setAttribute('contenteditable', 'false'); // Default: not editable
     taskCard.appendChild(taskTextElement);

     const taskActions = document.createElement('div');
     taskActions.classList.add('task-actions');

     // --- Conditional Edit Functionality ---
     if (task.column === 'todo') {
         taskCard.classList.add('editable'); // Mark card as editable

         // Add Edit Icon only for 'todo' tasks
         const editIcon = document.createElement('span');
         editIcon.classList.add('task-icon', 'edit-icon');
         editIcon.textContent = '✎';
         editIcon.title = 'Edit task';
         editIcon.addEventListener('click', (e) => {
             e.stopPropagation();
             startEditing(taskCard, taskTextElement);
         });
         taskActions.appendChild(editIcon);

         // Add Double-click listener only for 'todo' tasks
         taskCard.addEventListener('dblclick', (e) => {
             if (!e.target.classList.contains('task-icon')) {
                 startEditing(taskCard, taskTextElement);
             }
         });
     } else {
          // Ensure contenteditable is false if not in 'todo' (safety check)
          taskTextElement.setAttribute('contenteditable', 'false');
     }

     // --- Conditional Delete Functionality ---
     if (task.column === 'done') {
         const deleteIcon = document.createElement('span');
         deleteIcon.classList.add('task-icon', 'delete-icon');
         deleteIcon.textContent = '🗑️';
         deleteIcon.title = 'Delete task';
         deleteIcon.addEventListener('click', (e) => {
             e.stopPropagation();
             requestDeleteTask(task.id); // Show confirmation modal
         });
         taskActions.appendChild(deleteIcon);
     }

     taskCard.appendChild(taskActions);

     // Drag listeners (always added)
     taskCard.addEventListener('dragstart', handleDragStart);
     taskCard.addEventListener('dragend', handleDragEnd);

     return taskCard;
 }

 function renderTasks() {
     document.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');
     tasks.forEach(task => {
         const columnElement = document.getElementById(task.column)?.querySelector('.task-list');
         if (columnElement) {
             const taskElement = createTaskElement(task);
             columnElement.appendChild(taskElement);
         } else {
             console.warn(`Column element not found for task column: ${task.column}`);
         }
     });
 }

 function saveTasks() {
     localStorage.setItem('kanbanTasks', JSON.stringify(tasks));
 }

 function loadTasks() {
     const savedTasks = localStorage.getItem('kanbanTasks');
     if (savedTasks) {
         tasks = JSON.parse(savedTasks);
     } else {
         tasks = [
             { id: generateId(), text: 'Example: Drag me!', column: 'todo' },
             { id: generateId(), text: 'Example: Double-click/icon to edit (only in To Do).', column: 'todo' },
             { id: generateId(), text: 'Example: Move to Done for confetti & delete option.', column: 'inprogress' }
         ];
     }
     renderTasks();
 }

 function addTask() {
     const taskText = newTaskInput.value.trim();
     if (taskText === '') return;
     const newTask = { id: generateId(), text: taskText, column: 'todo' };
     tasks.push(newTask);
     saveTasks();
     renderTasks();
     newTaskInput.value = '';
 }

 /**
  * Shows the delete confirmation modal.
  * @param {string} taskId - The ID of the task to potentially delete.
  */
 function requestDeleteTask(taskId) {
     taskToDeleteId = taskId; // Store the ID
     deleteConfirmModal.classList.add('visible');
 }

 /**
  * Hides the delete confirmation modal.
  */
 function hideDeleteModal() {
     taskToDeleteId = null; // Clear the stored ID
     deleteConfirmModal.classList.remove('visible');
 }

 /**
  * Performs the actual deletion after confirmation.
  */
 function confirmDelete() {
     if (taskToDeleteId) {
         tasks = tasks.filter(task => task.id !== taskToDeleteId);
         saveTasks();
         renderTasks();
     } else {
          console.error("No task ID stored for deletion.");
     }
     hideDeleteModal(); // Hide modal after action
 }


 /**
  * Shows the edit warning notification.
  */
 function showEditWarning() {
      // Clear any existing timeout to prevent multiple notifications stacking
      if (notificationTimeout) {
          clearTimeout(notificationTimeout);
      }
      editWarningNotification.classList.add('visible');
      // Automatically hide after a few seconds
      notificationTimeout = setTimeout(() => {
          editWarningNotification.classList.remove('visible');
          notificationTimeout = null;
      }, 4000); // Hide after 4 seconds
 }


 /**
  * Starts the editing process for a task (only if in 'todo').
  */
 function startEditing(taskCard, taskTextElement) {
      // Double check if the card is actually editable (should be in 'todo')
      if (!taskCard.classList.contains('editable')) {
          console.warn("Attempted to edit non-editable task.");
          return;
      }

      // --- Show Edit Warning ---
      showEditWarning();

      taskCard.classList.add('editing');
      taskCard.setAttribute('draggable', 'false');
      taskTextElement.setAttribute('contenteditable', 'true');
      originalTaskText = taskTextElement.textContent;
      taskTextElement.focus();
      // Select text
      const range = document.createRange();
      range.selectNodeContents(taskTextElement);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      taskTextElement.addEventListener('blur', handleEditBlur, { once: true }); // Use once to auto-remove
      taskTextElement.addEventListener('keydown', handleEditKeyDown);
 }

 function saveEdit(taskCard, taskTextElement) {
     const taskId = taskCard.dataset.taskId;
     const newText = taskTextElement.textContent.trim();

     if (newText === '') {
         taskTextElement.textContent = originalTaskText;
         console.warn("Task text cannot be empty. Reverted changes.");
     } else {
         const taskIndex = tasks.findIndex(t => t.id === taskId);
         if (taskIndex > -1) {
             tasks[taskIndex].text = newText;
             saveTasks();
         } else {
             console.error("Could not find task to save edit:", taskId);
         }
     }
     // Clean up editing state
     taskTextElement.setAttribute('contenteditable', 'false');
     taskCard.classList.remove('editing');
     taskCard.setAttribute('draggable', 'true');
     // Remove keydown listener explicitly
     taskTextElement.removeEventListener('keydown', handleEditKeyDown);
      // Blur listener is removed automatically due to { once: true }
 }

 function cancelEdit(taskCard, taskTextElement) {
     taskTextElement.textContent = originalTaskText;
     taskTextElement.setAttribute('contenteditable', 'false');
     taskCard.classList.remove('editing');
     taskCard.setAttribute('draggable', 'true');
     taskTextElement.removeEventListener('keydown', handleEditKeyDown);
     // Blur listener is removed automatically due to { once: true }
 }

 // --- Event Handlers for Editing ---
 function handleEditBlur(event) {
     const taskTextElement = event.target;
     const taskCard = taskTextElement.closest('.task-card');
     // Check if still editing (might have been cancelled by Escape)
     if (taskCard.classList.contains('editing')) {
          saveEdit(taskCard, taskTextElement);
     }
 }

 function handleEditKeyDown(event) {
     const taskTextElement = event.target;
     const taskCard = taskTextElement.closest('.task-card');
     if (event.key === 'Enter') {
         event.preventDefault();
         saveEdit(taskCard, taskTextElement);
     } else if (event.key === 'Escape') {
         cancelEdit(taskCard, taskTextElement);
     }
 }

 function launchConfetti() {
     confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, zIndex: 1000 });
 }

 // --- Drag and Drop Event Handlers ---
 function handleDragStart(event) {
     if (event.target.classList.contains('task-card') && !event.target.classList.contains('editing')) {
         draggedTask = event.target;
         event.dataTransfer.setData('text/plain', event.target.dataset.taskId);
         event.dataTransfer.effectAllowed = 'move';
         setTimeout(() => event.target.classList.add('dragging'), 0);
     } else {
         event.preventDefault();
     }
 }

 function handleDragEnd(event) {
     if (draggedTask) draggedTask.classList.remove('dragging');
     columns.forEach(column => column.classList.remove('drag-over'));
     draggedTask = null;
 }

 function handleDragEnter(event) {
     event.preventDefault();
     if (event.target.classList.contains('kanban-column')) {
         event.target.classList.add('drag-over');
     }
 }

 function handleDragOver(event) {
     event.preventDefault();
     event.dataTransfer.dropEffect = 'move';
     if (event.target.classList.contains('kanban-column') && !event.target.classList.contains('drag-over')) {
          event.target.classList.add('drag-over');
      }
 }

 function handleDragLeave(event) {
      if (event.target.classList.contains('kanban-column')) {
          event.target.classList.remove('drag-over');
     }
 }

 function handleDrop(event) {
     event.preventDefault();
     const targetColumnElement = event.target.closest('.kanban-column');
     if (!targetColumnElement || !draggedTask) return;

     targetColumnElement.classList.remove('drag-over');
     const taskId = event.dataTransfer.getData('text/plain');
     const targetColumnId = targetColumnElement.id;
     const taskIndex = tasks.findIndex(t => t.id === taskId);

     if (taskIndex > -1) {
         const previousColumn = tasks[taskIndex].column;
         tasks[taskIndex].column = targetColumnId;
         if (targetColumnId === 'done' && previousColumn !== 'done') launchConfetti();
         saveTasks();
         renderTasks(); // Re-render necessary to update icons/listeners
     } else {
         console.error("Dropped task ID not found:", taskId);
     }
     draggedTask = null;
 }

 // --- Initial Event Listeners ---
 addTaskBtn.addEventListener('click', addTask);
 newTaskInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') addTask(); });

 columns.forEach(column => {
     column.addEventListener('dragover', handleDragOver);
     column.addEventListener('dragenter', handleDragEnter);
     column.addEventListener('dragleave', handleDragLeave);
     column.addEventListener('drop', handleDrop);
 });

 // Modal button listeners
 confirmDeleteBtn.addEventListener('click', confirmDelete);
 cancelDeleteBtn.addEventListener('click', hideDeleteModal);
 // Optional: Close modal if clicking overlay
 deleteConfirmModal.addEventListener('click', (e) => {
     if (e.target === deleteConfirmModal) { // Check if click is on overlay itself
         hideDeleteModal();
     }
 });

 // --- Initial Load ---
 document.addEventListener('DOMContentLoaded', loadTasks);
