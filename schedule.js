"use strict";

const STORAGE_KEY = "portfolio2-scheduler-v1";
const SESSION_KEY = "portfolio2-scheduler-session";

const employeeColors = [
    "#007aff",
    "#34c759",
    "#ff9500",
    "#af52de",
    "#ff3b30",
    "#5ac8fa",
    "#5856d6",
    "#ff2d55"
];

const stateTemplate = () => ({
    managerCode: "MANAGER2026",
    employees: [
        { id: "emp-alex", name: "Alex Morgan", role: "Front desk", code: "ALEX101", color: "#007aff" },
        { id: "emp-mia", name: "Mia Chen", role: "Service", code: "MIA204", color: "#34c759" },
        { id: "emp-noah", name: "Noah Pop", role: "Support", code: "NOAH315", color: "#ff9500" }
    ],
    availability: {},
    shifts: {}
});

let state = loadState();
let currentUser = loadSession();
let activeView = currentUser && currentUser.type === "employee" ? "employeeAvailability" : "schedule";
let currentMonth = startOfMonth(new Date());
let selectedDate = formatDate(new Date());
let pendingAvailabilityStatus = "available";

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
    captureDom();
    bindEvents();
    render();
});

function captureDom() {
    [
        "loginView",
        "appView",
        "loginForm",
        "loginMessage",
        "accessCode",
        "toggleCodeBtn",
        "logoutBtn",
        "sessionPill",
        "profileAvatar",
        "profileName",
        "profileRole",
        "surfaceEyebrow",
        "surfaceTitle",
        "prevMonthBtn",
        "nextMonthBtn",
        "todayBtn",
        "monthLabel",
        "managerScheduleView",
        "employeeAvailabilityView",
        "managerAvailabilityView",
        "employeesView",
        "managerWeekdays",
        "employeeWeekdays",
        "managerCalendarGrid",
        "employeeCalendarGrid",
        "managerSelectedDate",
        "employeeSelectedDate",
        "managerDayAvailability",
        "shiftForm",
        "shiftEmployee",
        "shiftRole",
        "shiftStart",
        "shiftEnd",
        "shiftNote",
        "dayShiftList",
        "availabilityForm",
        "availableStart",
        "availableEnd",
        "availabilityNote",
        "clearAvailabilityBtn",
        "employeeDayShifts",
        "availabilityMatrix",
        "employeeForm",
        "employeeName",
        "employeeRole",
        "employeeCode",
        "generateCodeBtn",
        "employeeFormMessage",
        "employeeList"
    ].forEach((id) => {
        dom[id] = document.getElementById(id);
    });
}

function bindEvents() {
    dom.loginForm.addEventListener("submit", handleLogin);
    dom.toggleCodeBtn.addEventListener("click", toggleAccessCode);
    dom.logoutBtn.addEventListener("click", logout);
    dom.prevMonthBtn.addEventListener("click", () => changeMonth(-1));
    dom.nextMonthBtn.addEventListener("click", () => changeMonth(1));
    dom.todayBtn.addEventListener("click", jumpToToday);
    dom.managerCalendarGrid.addEventListener("click", handleCalendarClick);
    dom.employeeCalendarGrid.addEventListener("click", handleCalendarClick);
    dom.shiftForm.addEventListener("submit", handleShiftSubmit);
    dom.availabilityForm.addEventListener("submit", handleAvailabilitySubmit);
    dom.clearAvailabilityBtn.addEventListener("click", clearAvailability);
    dom.employeeForm.addEventListener("submit", handleEmployeeSubmit);
    dom.generateCodeBtn.addEventListener("click", fillGeneratedEmployeeCode);
    dom.employeeList.addEventListener("click", handleEmployeeListClick);
    dom.dayShiftList.addEventListener("click", handleShiftListClick);

    document.querySelectorAll(".side-nav-item").forEach((button) => {
        button.addEventListener("click", () => {
            setActiveView(button.dataset.view);
        });
    });

    document.querySelectorAll(".segment").forEach((button) => {
        button.addEventListener("click", () => {
            pendingAvailabilityStatus = button.dataset.status;
            renderAvailabilityForm();
        });
    });
}

function loadState() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!stored || !Array.isArray(stored.employees)) return stateTemplate();
        return {
            ...stateTemplate(),
            ...stored,
            availability: stored.availability || {},
            shifts: stored.shifts || {}
        };
    } catch (error) {
        return stateTemplate();
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSession() {
    try {
        const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        if (!session) return null;
        if (session.type === "manager") return session;
        const employee = state.employees.find((item) => item.id === session.employeeId);
        return employee ? { type: "employee", employeeId: employee.id } : null;
    } catch (error) {
        return null;
    }
}

function saveSession() {
    if (!currentUser) {
        sessionStorage.removeItem(SESSION_KEY);
        return;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
}

function handleLogin(event) {
    event.preventDefault();
    const code = normalizeCode(dom.accessCode.value);
    const employee = state.employees.find((item) => normalizeCode(item.code) === code);

    if (code === normalizeCode(state.managerCode)) {
        currentUser = { type: "manager" };
        activeView = "schedule";
    } else if (employee) {
        currentUser = { type: "employee", employeeId: employee.id };
        activeView = "employeeAvailability";
    } else {
        dom.loginMessage.textContent = "That access code does not match any account.";
        return;
    }

    dom.accessCode.value = "";
    dom.loginMessage.textContent = "";
    saveSession();
    render();
}

function toggleAccessCode() {
    const isPassword = dom.accessCode.type === "password";
    dom.accessCode.type = isPassword ? "text" : "password";
    dom.toggleCodeBtn.setAttribute("aria-label", isPassword ? "Hide access code" : "Show access code");
    dom.toggleCodeBtn.setAttribute("title", isPassword ? "Hide access code" : "Show access code");
    dom.toggleCodeBtn.innerHTML = `<i data-lucide="${isPassword ? "eye-off" : "eye"}"></i>`;
    refreshIcons();
}

function logout() {
    currentUser = null;
    saveSession();
    render();
}

function render() {
    if (!currentUser) {
        dom.loginView.hidden = false;
        dom.appView.hidden = true;
        dom.logoutBtn.hidden = true;
        dom.sessionPill.hidden = true;
        refreshIcons();
        return;
    }

    dom.loginView.hidden = true;
    dom.appView.hidden = false;
    dom.logoutBtn.hidden = false;
    dom.sessionPill.hidden = false;

    updateSessionUi();
    renderWeekdays();
    renderMonthLabel();
    renderNavigation();
    renderActiveView();
    refreshIcons();
}

function updateSessionUi() {
    if (currentUser.type === "manager") {
        dom.profileAvatar.textContent = "M";
        dom.profileAvatar.style.background = "#1d1d1f";
        dom.profileName.textContent = "Manager";
        dom.profileRole.textContent = "Schedule manager";
        dom.sessionPill.textContent = "Manager";
        return;
    }

    const employee = getCurrentEmployee();
    dom.profileAvatar.textContent = getInitials(employee.name);
    dom.profileAvatar.style.background = employee.color;
    dom.profileName.textContent = employee.name;
    dom.profileRole.textContent = employee.role || "Employee";
    dom.sessionPill.textContent = employee.name;
}

function renderNavigation() {
    const isManager = currentUser.type === "manager";
    document.querySelectorAll(".manager-only").forEach((item) => {
        item.hidden = !isManager;
    });
    document.querySelectorAll(".employee-only").forEach((item) => {
        item.hidden = isManager;
    });
    document.querySelectorAll(".side-nav-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.view === activeView);
    });
}

function renderActiveView() {
    const views = {
        schedule: dom.managerScheduleView,
        employeeAvailability: dom.employeeAvailabilityView,
        managerAvailability: dom.managerAvailabilityView,
        employees: dom.employeesView
    };

    Object.entries(views).forEach(([name, element]) => {
        element.hidden = name !== activeView;
    });

    const titles = {
        schedule: ["Manager", "Schedule"],
        employeeAvailability: ["Employee", "My Month"],
        managerAvailability: ["Manager", "Availability"],
        employees: ["Manager", "Employees"]
    };
    const [eyebrow, title] = titles[activeView] || titles.schedule;
    dom.surfaceEyebrow.textContent = eyebrow;
    dom.surfaceTitle.textContent = title;

    if (activeView === "schedule") renderManagerSchedule();
    if (activeView === "employeeAvailability") renderEmployeeAvailability();
    if (activeView === "managerAvailability") renderAvailabilityMatrix();
    if (activeView === "employees") renderEmployees();
}

function setActiveView(view) {
    if (currentUser.type === "employee") {
        activeView = "employeeAvailability";
    } else {
        activeView = view;
    }
    render();
}

function renderWeekdays() {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const markup = days.map((day) => `<span>${day}</span>`).join("");
    dom.managerWeekdays.innerHTML = markup;
    dom.employeeWeekdays.innerHTML = markup;
}

function renderMonthLabel() {
    dom.monthLabel.textContent = monthTitle(currentMonth);
}

function renderManagerSchedule() {
    renderCalendar(dom.managerCalendarGrid, "manager");
    dom.managerSelectedDate.textContent = longDate(selectedDate);
    renderShiftEmployeeOptions();
    renderManagerDayAvailability();
    renderDayShifts();
}

function renderEmployeeAvailability() {
    const employee = getCurrentEmployee();
    if (!employee) {
        logout();
        return;
    }
    renderCalendar(dom.employeeCalendarGrid, "employee");
    dom.employeeSelectedDate.textContent = longDate(selectedDate);
    const saved = getAvailability(employee.id, selectedDate);
    pendingAvailabilityStatus = saved ? saved.status : pendingAvailabilityStatus;
    renderAvailabilityForm();
    renderEmployeeDayShifts(employee.id);
}

function renderCalendar(container, mode) {
    const cells = getCalendarCells(currentMonth);
    const today = formatDate(new Date());

    container.innerHTML = cells.map((date) => {
        const dateKey = formatDate(date);
        const outside = date.getMonth() !== currentMonth.getMonth();
        const isToday = dateKey === today;
        const isSelected = dateKey === selectedDate;
        const classes = [
            "day-cell",
            outside ? "outside" : "",
            isToday ? "today" : "",
            isSelected ? "selected" : ""
        ].filter(Boolean).join(" ");
        return `
            <button class="${classes}" type="button" data-date="${dateKey}">
                <div class="day-head">
                    <span class="day-number">${date.getDate()}</span>
                    ${mode === "manager" ? renderAvailabilityDots(dateKey) : renderEmployeeStatusBadge(dateKey)}
                </div>
                <div class="day-events">
                    ${mode === "manager" ? renderShiftPills(dateKey) : renderEmployeeShiftPills(dateKey)}
                </div>
            </button>
        `;
    }).join("");
}

function renderAvailabilityDots(dateKey) {
    const summary = getAvailabilitySummary(dateKey);
    const dots = [];
    if (summary.available) dots.push(`<b class="dot available" title="${summary.available} available"></b>`);
    if (summary.maybe) dots.push(`<b class="dot maybe" title="${summary.maybe} maybe"></b>`);
    if (summary.unavailable) dots.push(`<b class="dot unavailable" title="${summary.unavailable} unavailable"></b>`);
    return dots.length ? `<span class="availability-dots">${dots.join("")}</span>` : "";
}

function renderEmployeeStatusBadge(dateKey) {
    const employee = getCurrentEmployee();
    const availability = employee ? getAvailability(employee.id, dateKey) : null;
    if (!availability) return "";
    return `<span class="status-badge ${availability.status}">${statusShort(availability.status)}</span>`;
}

function renderShiftPills(dateKey) {
    const shifts = state.shifts[dateKey] || [];
    const visible = shifts.slice(0, 2).map((shift) => {
        const employee = getEmployee(shift.employeeId);
        const color = employee ? employee.color : "#8e8e93";
        return `
            <div class="shift-pill" style="background:${color}">
                <span>${escapeHtml(formatShiftLabel(shift, employee))}</span>
            </div>
        `;
    });
    if (shifts.length > 2) visible.push(`<span class="more-count">+${shifts.length - 2} more</span>`);
    return visible.join("");
}

function renderEmployeeShiftPills(dateKey) {
    const employee = getCurrentEmployee();
    if (!employee) return "";
    const shifts = (state.shifts[dateKey] || []).filter((shift) => shift.employeeId === employee.id);
    return shifts.map((shift) => `
        <div class="shift-pill" style="background:${employee.color}">
            <span>${escapeHtml(shift.start)}-${escapeHtml(shift.end)}</span>
        </div>
    `).join("");
}

function renderShiftEmployeeOptions() {
    if (!state.employees.length) {
        dom.shiftEmployee.innerHTML = `<option value="">No employees yet</option>`;
        dom.shiftForm.querySelector(".primary-button").disabled = true;
        return;
    }

    dom.shiftEmployee.innerHTML = state.employees.map((employee) => (
        `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`
    )).join("");
    dom.shiftForm.querySelector(".primary-button").disabled = false;
}

function renderManagerDayAvailability() {
    if (!state.employees.length) {
        dom.managerDayAvailability.innerHTML = `<p class="empty-state">No employees have been added yet.</p>`;
        return;
    }

    dom.managerDayAvailability.innerHTML = state.employees.map((employee) => {
        const availability = getAvailability(employee.id, selectedDate);
        const status = availability ? availability.status : "none";
        const detail = availability
            ? `${statusLabel(status)}${availability.start && availability.end ? `, ${availability.start}-${availability.end}` : ""}`
            : "No availability added";
        return `
            <div class="availability-line">
                <div>
                    <div class="availability-name">${escapeHtml(employee.name)}</div>
                    <div class="availability-detail">${escapeHtml(detail)}</div>
                </div>
                ${availability ? `<b class="dot ${status}"></b>` : `<b class="dot"></b>`}
            </div>
        `;
    }).join("");
}

function renderDayShifts() {
    const shifts = state.shifts[selectedDate] || [];
    if (!shifts.length) {
        dom.dayShiftList.innerHTML = `<p class="empty-state">No shifts for this day.</p>`;
        return;
    }

    dom.dayShiftList.innerHTML = shifts.map((shift) => {
        const employee = getEmployee(shift.employeeId);
        const color = employee ? employee.color : "#8e8e93";
        return `
            <div class="mini-shift" style="background:${color}">
                <span>${escapeHtml(formatShiftLabel(shift, employee))}</span>
                <button type="button" data-action="remove-shift" data-id="${shift.id}" aria-label="Remove shift" title="Remove shift">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
    }).join("");
    refreshIcons();
}

function renderAvailabilityForm() {
    document.querySelectorAll(".segment").forEach((button) => {
        button.classList.toggle("active", button.dataset.status === pendingAvailabilityStatus);
    });

    const employee = getCurrentEmployee();
    const saved = employee ? getAvailability(employee.id, selectedDate) : null;
    dom.availableStart.value = saved && saved.start ? saved.start : "09:00";
    dom.availableEnd.value = saved && saved.end ? saved.end : "17:00";
    dom.availabilityNote.value = saved && saved.note ? saved.note : "";
    const disableTime = pendingAvailabilityStatus === "unavailable";
    dom.availableStart.disabled = disableTime;
    dom.availableEnd.disabled = disableTime;
}

function renderEmployeeDayShifts(employeeId) {
    const shifts = (state.shifts[selectedDate] || []).filter((shift) => shift.employeeId === employeeId);
    if (!shifts.length) {
        dom.employeeDayShifts.innerHTML = `<p class="empty-state">No scheduled shifts for this day.</p>`;
        return;
    }

    const employee = getEmployee(employeeId);
    dom.employeeDayShifts.innerHTML = shifts.map((shift) => `
        <div class="mini-shift" style="background:${employee.color}">
            <span>${escapeHtml(shift.start)}-${escapeHtml(shift.end)} ${escapeHtml(shift.role || "Shift")}</span>
        </div>
    `).join("");
}

function renderAvailabilityMatrix() {
    const days = getMonthDates(currentMonth);
    dom.availabilityMatrix.style.gridTemplateColumns = `minmax(150px, 1.3fr) repeat(${days.length}, minmax(34px, 1fr))`;

    const header = [
        `<div class="matrix-day"></div>`,
        ...days.map((date) => `
            <div class="matrix-day">
                <span>${date.getDate()}</span>
            </div>
        `)
    ];

    const rows = state.employees.flatMap((employee) => [
        `<div class="matrix-employee">${escapeHtml(employee.name)}</div>`,
        ...days.map((date) => {
            const availability = getAvailability(employee.id, formatDate(date));
            const label = availability ? statusShort(availability.status) : "";
            const title = availability ? `${employee.name}: ${statusLabel(availability.status)}` : `${employee.name}: no entry`;
            return `<div class="matrix-cell ${availability ? availability.status : ""}" title="${escapeHtml(title)}">${label}</div>`;
        })
    ]);

    dom.availabilityMatrix.innerHTML = state.employees.length
        ? [...header, ...rows].join("")
        : `<p class="empty-state">No employees have been added yet.</p>`;
}

function renderEmployees() {
    dom.employeeList.innerHTML = state.employees.length
        ? state.employees.map((employee) => `
            <div class="employee-row">
                <div class="employee-meta">
                    <span class="employee-color" style="background:${employee.color}"></span>
                    <div>
                        <p class="employee-name">${escapeHtml(employee.name)}</p>
                        <p class="employee-sub">${escapeHtml(employee.role || "Employee")}</p>
                    </div>
                </div>
                <span class="code-chip">${escapeHtml(employee.code)}</span>
                <button class="danger-button" type="button" data-action="remove-employee" data-id="${employee.id}" aria-label="Remove ${escapeHtml(employee.name)}" title="Remove employee">
                    <i data-lucide="user-minus"></i>
                </button>
            </div>
        `).join("")
        : `<p class="empty-state">No employees have been added yet.</p>`;
    refreshIcons();
}

function handleCalendarClick(event) {
    const cell = event.target.closest(".day-cell");
    if (!cell) return;
    selectedDate = cell.dataset.date;
    const parsed = parseDate(selectedDate);
    if (parsed.getMonth() !== currentMonth.getMonth() || parsed.getFullYear() !== currentMonth.getFullYear()) {
        currentMonth = startOfMonth(parsed);
    }
    renderActiveView();
    renderMonthLabel();
}

function handleShiftSubmit(event) {
    event.preventDefault();
    const employeeId = dom.shiftEmployee.value;
    if (!employeeId) return;

    const shift = {
        id: `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        employeeId,
        start: dom.shiftStart.value,
        end: dom.shiftEnd.value,
        role: dom.shiftRole.value.trim(),
        note: dom.shiftNote.value.trim()
    };

    state.shifts[selectedDate] = [...(state.shifts[selectedDate] || []), shift];
    saveState();
    dom.shiftNote.value = "";
    renderManagerSchedule();
}

function handleShiftListClick(event) {
    const button = event.target.closest("[data-action='remove-shift']");
    if (!button) return;
    const shifts = state.shifts[selectedDate] || [];
    state.shifts[selectedDate] = shifts.filter((shift) => shift.id !== button.dataset.id);
    if (!state.shifts[selectedDate].length) delete state.shifts[selectedDate];
    saveState();
    renderManagerSchedule();
}

function handleAvailabilitySubmit(event) {
    event.preventDefault();
    const employee = getCurrentEmployee();
    if (!employee) return;

    if (!state.availability[employee.id]) state.availability[employee.id] = {};
    state.availability[employee.id][selectedDate] = {
        status: pendingAvailabilityStatus,
        start: pendingAvailabilityStatus === "unavailable" ? "" : dom.availableStart.value,
        end: pendingAvailabilityStatus === "unavailable" ? "" : dom.availableEnd.value,
        note: dom.availabilityNote.value.trim()
    };
    saveState();
    renderEmployeeAvailability();
}

function clearAvailability() {
    const employee = getCurrentEmployee();
    if (!employee || !state.availability[employee.id]) return;
    delete state.availability[employee.id][selectedDate];
    saveState();
    renderEmployeeAvailability();
}

function handleEmployeeSubmit(event) {
    event.preventDefault();
    const name = dom.employeeName.value.trim();
    const role = dom.employeeRole.value.trim();
    const code = normalizeCode(dom.employeeCode.value || generateEmployeeCode(name));

    if (!name) return;
    if (code === normalizeCode(state.managerCode) || state.employees.some((employee) => normalizeCode(employee.code) === code)) {
        dom.employeeFormMessage.textContent = "That access code is already in use.";
        return;
    }

    const employee = {
        id: `emp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        role,
        code,
        color: employeeColors[state.employees.length % employeeColors.length]
    };

    state.employees.push(employee);
    saveState();
    dom.employeeForm.reset();
    dom.employeeFormMessage.textContent = "";
    renderEmployees();
}

function fillGeneratedEmployeeCode() {
    dom.employeeCode.value = generateEmployeeCode(dom.employeeName.value.trim());
}

function handleEmployeeListClick(event) {
    const button = event.target.closest("[data-action='remove-employee']");
    if (!button) return;
    removeEmployee(button.dataset.id);
}

function removeEmployee(employeeId) {
    state.employees = state.employees.filter((employee) => employee.id !== employeeId);
    delete state.availability[employeeId];
    Object.keys(state.shifts).forEach((dateKey) => {
        state.shifts[dateKey] = state.shifts[dateKey].filter((shift) => shift.employeeId !== employeeId);
        if (!state.shifts[dateKey].length) delete state.shifts[dateKey];
    });
    if (currentUser && currentUser.type === "employee" && currentUser.employeeId === employeeId) {
        currentUser = null;
        saveSession();
    }
    saveState();
    render();
}

function changeMonth(delta) {
    currentMonth = addMonths(currentMonth, delta);
    selectedDate = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    renderMonthLabel();
    renderActiveView();
}

function jumpToToday() {
    const today = new Date();
    currentMonth = startOfMonth(today);
    selectedDate = formatDate(today);
    renderMonthLabel();
    renderActiveView();
}

function getCurrentEmployee() {
    if (!currentUser || currentUser.type !== "employee") return null;
    return getEmployee(currentUser.employeeId);
}

function getEmployee(employeeId) {
    return state.employees.find((employee) => employee.id === employeeId);
}

function getAvailability(employeeId, dateKey) {
    return state.availability[employeeId] ? state.availability[employeeId][dateKey] : null;
}

function getAvailabilitySummary(dateKey) {
    return state.employees.reduce((summary, employee) => {
        const availability = getAvailability(employee.id, dateKey);
        if (availability) summary[availability.status] += 1;
        return summary;
    }, { available: 0, maybe: 0, unavailable: 0 });
}

function getCalendarCells(monthDate) {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
    });
}

function getMonthDates(monthDate) {
    const total = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    return Array.from({ length: total }, (_, index) => new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1));
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function parseDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function monthTitle(date) {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function longDate(dateKey) {
    return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric"
    }).format(parseDate(dateKey));
}

function normalizeCode(code) {
    return String(code).trim().replace(/\s+/g, "").toUpperCase();
}

function generateEmployeeCode(name) {
    const prefix = normalizeCode(name).replace(/[^A-Z0-9]/g, "").slice(0, 4) || "EMP";
    let code = "";
    do {
        code = `${prefix}${Math.floor(100 + Math.random() * 900)}`;
    } while (code === normalizeCode(state.managerCode) || state.employees.some((employee) => normalizeCode(employee.code) === code));
    return code;
}

function getInitials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function statusLabel(status) {
    return {
        available: "Available",
        maybe: "Maybe",
        unavailable: "Unavailable"
    }[status] || "No entry";
}

function statusShort(status) {
    return {
        available: "A",
        maybe: "?",
        unavailable: "X"
    }[status] || "";
}

function formatShiftLabel(shift, employee) {
    const name = employee ? employee.name : "Removed employee";
    const role = shift.role ? `, ${shift.role}` : "";
    return `${shift.start}-${shift.end} ${name}${role}`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
}
