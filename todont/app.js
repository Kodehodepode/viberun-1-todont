"use strict";

const STORAGE_KEY = "todont.tasks.v1";
const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const repeatInput = document.querySelector("#repeat-input");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const remainingCount = document.querySelector("#remaining-count");
const remainingLabel = document.querySelector("#remaining-label");
const todayLabel = document.querySelector("#today-label");
const storageMessage = document.querySelector("#storage-message");

let tasks = [];
let loadFailed = false;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showStorageMessage(message) {
  storageMessage.textContent = message;
  storageMessage.hidden = false;
}

function validateTasks(value) {
  if (!Array.isArray(value)) {
    throw new Error("Saved task data is not a list.");
  }

  for (const task of value) {
    if (
      task === null ||
      typeof task !== "object" ||
      typeof task.id !== "string" ||
      typeof task.title !== "string" ||
      typeof task.repeat !== "boolean" ||
      typeof task.checked !== "boolean" ||
      (task.repeat && typeof task.lastResetDate !== "string")
    ) {
      throw new Error("Saved task data contains an invalid item.");
    }
  }

  return value;
}

function loadTasks() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === null ? [] : validateTasks(JSON.parse(saved));
  } catch (error) {
    loadFailed = true;
    taskForm.querySelectorAll("input, button").forEach((control) => {
      control.disabled = true;
    });
    const detail = error instanceof Error ? error.message : "Unknown storage error.";
    showStorageMessage(`Your saved list could not be loaded, so changes are disabled to protect it. ${detail}`);
    return [];
  }
}

function saveTasks() {
  if (loadFailed) return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    storageMessage.hidden = true;
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown storage error.";
    showStorageMessage(`This list could not be saved to this device. Your changes are still visible until you close this page. ${detail}`);
    return false;
  }
}

function reconcileRepeatingTasks() {
  const today = localDateKey();
  let changed = false;

  tasks = tasks.map((task) => {
    if (task.repeat && task.lastResetDate !== today) {
      changed = true;
      return { ...task, checked: false, lastResetDate: today };
    }
    return task;
  });

  if (changed) saveTasks();
}

function makeTaskElement(task) {
  const item = document.createElement("li");
  item.className = `task-item${task.checked ? " is-checked" : ""}`;
  item.dataset.taskId = task.id;

  const checkButton = document.createElement("button");
  checkButton.className = "task-check";
  checkButton.type = "button";
  checkButton.setAttribute("aria-label", `${task.checked ? "Mark as not avoided" : "Mark as avoided"}: ${task.title}`);
  checkButton.setAttribute("aria-pressed", String(task.checked));

  const copy = document.createElement("div");
  copy.className = "task-copy";

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;
  copy.append(title);

  if (task.repeat) {
    const badge = document.createElement("span");
    badge.className = "repeat-badge";
    badge.textContent = "Every day";
    copy.append(badge);
  }

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Delete: ${task.title}`);
  deleteButton.textContent = "×";

  item.append(checkButton, copy, deleteButton);
  return item;
}

function render() {
  taskList.replaceChildren(...tasks.map(makeTaskElement));
  emptyState.hidden = tasks.length > 0;
  const remaining = tasks.filter((task) => !task.checked).length;
  remainingCount.textContent = String(remaining);
  remainingLabel.textContent = "to avoid";
  todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function addTask(title, repeat) {
  const task = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    repeat,
    checked: false,
  };

  if (repeat) task.lastResetDate = localDateKey();
  tasks.push(task);
  saveTasks();
  render();
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    return;
  }

  addTask(title, repeatInput.checked);
  taskForm.reset();
  taskInput.focus();
});

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const item = button.closest(".task-item");
  const task = tasks.find((candidate) => candidate.id === item?.dataset.taskId);
  if (!task) return;

  if (button.classList.contains("task-check")) {
    task.checked = !task.checked;
  } else if (button.classList.contains("delete-button")) {
    tasks = tasks.filter((candidate) => candidate.id !== task.id);
  } else {
    return;
  }

  saveTasks();
  render();
});

function scheduleMidnightRefresh() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  window.setTimeout(() => {
    reconcileRepeatingTasks();
    render();
    scheduleMidnightRefresh();
  }, midnight.getTime() - now.getTime() + 25);
}

window.addEventListener("focus", () => {
  reconcileRepeatingTasks();
  render();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    reconcileRepeatingTasks();
    render();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY || event.newValue === null) return;

  try {
    tasks = validateTasks(JSON.parse(event.newValue));
    reconcileRepeatingTasks();
    render();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown storage error.";
    showStorageMessage(`A change from another tab could not be loaded. ${detail}`);
  }
});

tasks = loadTasks();
reconcileRepeatingTasks();
render();
scheduleMidnightRefresh();
