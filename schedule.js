"use strict";

const STORAGE_KEY = "portfolio2-scheduler-v1";
const SESSION_KEY = "portfolio2-scheduler-session";
const SYNC_ENDPOINT = "/api/scheduler";

const managerAreas = {
    foh: {
        code: "FOH2026",
        label: "Front of House",
        shortLabel: "FOH",
        title: "Front of House Schedule",
        role: "Front of House manager"
    },
    boh: {
        code: "BOH2026",
        legacyCodes: ["MANAGER2026"],
        label: "Back of House",
        shortLabel: "BOH",
        title: "Back of House Schedule",
        role: "Kitchen manager"
    }
};

const kitchenCategories = [
    { id: "fulltime", label: "Permanent / full-time" },
    { id: "parttime-cook", label: "Part-time cooks" },
    { id: "dishwashing", label: "Dishwashing" }
];

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
    managerCodes: {
        foh: managerAreas.foh.code,
        boh: managerAreas.boh.code
    },
    employees: [
        { id: "emp-alex", name: "Alex Morgan", role: "Chef", code: "ALEX101", color: "#007aff", area: "boh", category: "fulltime" },
        { id: "emp-mia", name: "Mia Chen", role: "Part-time cook", code: "MIA204", color: "#34c759", area: "boh", category: "parttime-cook" },
        { id: "emp-noah", name: "Noah Pop", role: "Dishwashing", code: "NOAH315", color: "#ff9500", area: "boh", category: "dishwashing" }
    ],
    availability: {},
    shifts: {}
});

let state = normalizeState(loadState());
let currentUser = loadSession();
let activeView = currentUser && currentUser.type === "employee" ? "employeeAvailability" : "schedule";
let currentMonth = startOfMonth(new Date());
let selectedDate = formatDate(new Date());
let pendingAvailabilityStatus = "available";
let previousDocumentTitle = document.title;
let remoteSyncAvailable = false;
let remoteSaveTimer = null;
let isApplyingRemoteState = false;
let syncStatus = { label: "Local only", type: "local" };

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
    captureDom();
    bindEvents();
    render();
    hydrateRemoteState();
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
        "syncPill",
        "sessionPill",
        "profileAvatar",
        "profileName",
        "profileRole",
        "surfaceEyebrow",
        "surfaceTitle",
        "prevMonthBtn",
        "nextMonthBtn",
        "todayBtn",
        "exportPdfBtn",
        "monthLabel",
        "printHeading",
        "printPacket",
        "managerScheduleView",
        "employeeAvailabilityView",
        "managerAvailabilityView",
        "employeesView",
        "managerWeekdays",
        "employeeWeekdays",
        "managerCalendarGrid",
        "employeeCalendarGrid",
        "hoursScrollPrev",
        "hoursScrollNext",
        "managerHoursSummary",
        "employeeHoursSummary",
        "managerSelectedDate",
        "employeeSelectedDate",
        "managerDayAvailability",
        "shiftForm",
        "shiftEmployee",
        "shiftRole",
        "shiftStart",
        "shiftEnd",
        "shiftNote",
        "shiftFormMessage",
        "dayShiftList",
        "availabilityForm",
        "availableStart",
        "availableEnd",
        "availabilityNote",
        "clearAvailabilityBtn",
        "employeeDayShifts",
        "availabilityMatrixWrap",
        "availabilityMatrix",
        "availabilityScrollPrev",
        "availabilityScrollNext",
        "employeeForm",
        "employeeName",
        "employeeRole",
        "employeeCategoryGroup",
        "employeeCategory",
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
    dom.exportPdfBtn.addEventListener("click", exportCurrentViewAsPdf);
    dom.hoursScrollPrev.addEventListener("click", () => scrollStrip(dom.managerHoursSummary, -1));
    dom.hoursScrollNext.addEventListener("click", () => scrollStrip(dom.managerHoursSummary, 1));
    dom.managerHoursSummary.addEventListener("scroll", updateHoursScrollControls);
    dom.availabilityScrollPrev.addEventListener("click", () => scrollStrip(dom.availabilityMatrixWrap, -1));
    dom.availabilityScrollNext.addEventListener("click", () => scrollStrip(dom.availabilityMatrixWrap, 1));
    dom.availabilityMatrixWrap.addEventListener("scroll", updateAvailabilityScrollControls);
    dom.managerCalendarGrid.addEventListener("click", handleCalendarClick);
    dom.employeeCalendarGrid.addEventListener("click", handleCalendarClick);
    dom.shiftForm.addEventListener("submit", handleShiftSubmit);
    dom.availabilityForm.addEventListener("submit", handleAvailabilitySubmit);
    dom.clearAvailabilityBtn.addEventListener("click", clearAvailability);
    dom.employeeForm.addEventListener("submit", handleEmployeeSubmit);
    dom.generateCodeBtn.addEventListener("click", fillGeneratedEmployeeCode);
    dom.employeeList.addEventListener("click", handleEmployeeListClick);
    dom.employeeList.addEventListener("change", handleEmployeeListChange);
    dom.dayShiftList.addEventListener("click", handleShiftListClick);
    window.addEventListener("afterprint", cleanupPdfExport);
    window.addEventListener("resize", updateScrollControls);

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
        return stored;
    } catch (error) {
        return stateTemplate();
    }
}

function normalizeState(nextState) {
    const template = stateTemplate();
    return {
        ...template,
        ...(nextState || {}),
        managerCodes: {
            ...template.managerCodes,
            ...((nextState && nextState.managerCodes) || {})
        },
        employees: Array.isArray(nextState && nextState.employees)
            ? nextState.employees.map(normalizeEmployee)
            : template.employees.map(normalizeEmployee),
        availability: nextState && nextState.availability ? nextState.availability : {},
        shifts: nextState && nextState.shifts ? nextState.shifts : {}
    };
}

function normalizeEmployee(employee) {
    employee = employee || {};
    const area = employee && managerAreas[employee.area] ? employee.area : "boh";
    const category = area === "boh" && isKitchenCategory(employee && employee.category)
        ? employee.category
        : (area === "boh" ? "parttime-cook" : "front-of-house");

    return {
        ...employee,
        area,
        category
    };
}

function isKitchenCategory(category) {
    return kitchenCategories.some((item) => item.id === category);
}

function saveState(options = {}) {
    const shouldSync = options.sync !== false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (shouldSync && !isApplyingRemoteState) queueRemoteSave();
}

function loadSession() {
    try {
        const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        if (!session) return null;
        if (session.type === "manager") {
            return {
                type: "manager",
                area: managerAreas[session.area] ? session.area : "boh"
            };
        }
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

function getManagerByCode(code) {
    return Object.entries(managerAreas).map(([area, config]) => {
        const configuredCode = state.managerCodes && state.managerCodes[area] ? state.managerCodes[area] : config.code;
        const validCodes = [configuredCode, config.code, ...(config.legacyCodes || [])];
        if (area === "boh") validCodes.push(state.managerCode);
        return validCodes.some((item) => normalizeCode(item) === code) ? { area, ...config } : null;
    }).find(Boolean);
}

function isManagerCode(code) {
    return Boolean(getManagerByCode(normalizeCode(code)));
}

function getCurrentManagerArea() {
    if (!currentUser || currentUser.type !== "manager") return "boh";
    return managerAreas[currentUser.area] ? currentUser.area : "boh";
}

function getCurrentManagerConfig() {
    const area = getCurrentManagerArea();
    return { area, ...managerAreas[area] };
}

function getEmployeeArea(employee) {
    return employee && managerAreas[employee.area] ? employee.area : "boh";
}

function getEmployeeCategory(employee) {
    if (getEmployeeArea(employee) !== "boh") return "front-of-house";
    return isKitchenCategory(employee && employee.category) ? employee.category : "parttime-cook";
}

function getManagerEmployees() {
    const area = getCurrentManagerArea();
    return getSortedEmployees(state.employees.filter((employee) => getEmployeeArea(employee) === area), area);
}

function getSortedEmployees(employees, area = "boh") {
    const categoryRank = new Map(kitchenCategories.map((category, index) => [category.id, index]));
    return [...employees].sort((first, second) => {
        if (area === "boh") {
            const firstRank = categoryRank.get(getEmployeeCategory(first)) ?? kitchenCategories.length;
            const secondRank = categoryRank.get(getEmployeeCategory(second)) ?? kitchenCategories.length;
            if (firstRank !== secondRank) return firstRank - secondRank;
        }
        return first.name.localeCompare(second.name);
    });
}

function getGroupedEmployees(employees, area = "boh") {
    if (area !== "boh") {
        return [{ id: "foh", label: "Front of House", employees: getSortedEmployees(employees, area) }];
    }

    return kitchenCategories.map((category) => ({
        ...category,
        employees: employees.filter((employee) => getEmployeeCategory(employee) === category.id)
    }));
}

function getPrintEmployeeGroups(employees, area) {
    const maxRowsPerPage = 16;
    return getGroupedEmployees(employees, area)
        .filter((group) => group.employees.length)
        .flatMap((group) => {
            const chunks = chunkArray(group.employees, maxRowsPerPage);
            return chunks.map((employeesChunk, index) => ({
                label: chunks.length > 1 ? `${group.label} ${index + 1}/${chunks.length}` : group.label,
                employees: employeesChunk
            }));
        });
}

function chunkArray(items, size) {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

function employeeCategoryLabel(employee) {
    if (getEmployeeArea(employee) !== "boh") return "Front of House";
    return (kitchenCategories.find((category) => category.id === getEmployeeCategory(employee)) || kitchenCategories[1]).label;
}

function renderEmployeeCategorySelect(employee) {
    return `
        <select class="category-select" data-action="change-category" data-id="${employee.id}" aria-label="Category for ${escapeHtml(employee.name)}">
            ${kitchenCategories.map((category) => `
                <option value="${category.id}" ${getEmployeeCategory(employee) === category.id ? "selected" : ""}>${escapeHtml(category.label)}</option>
            `).join("")}
        </select>
    `;
}

function handleLogin(event) {
    event.preventDefault();
    const code = normalizeCode(dom.accessCode.value);
    const manager = getManagerByCode(code);
    const employee = state.employees.find((item) => normalizeCode(item.code) === code);

    if (manager) {
        currentUser = { type: "manager", area: manager.area };
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
        dom.syncPill.hidden = true;
        dom.sessionPill.hidden = true;
        refreshIcons();
        return;
    }

    dom.loginView.hidden = true;
    dom.appView.hidden = false;
    dom.logoutBtn.hidden = false;
    dom.syncPill.hidden = false;
    dom.sessionPill.hidden = false;

    updateSessionUi();
    renderSyncStatus();
    renderWeekdays();
    renderMonthLabel();
    renderNavigation();
    renderActiveView();
    refreshIcons();
}

async function hydrateRemoteState() {
    setSyncStatus("Checking sync", "saving");
    try {
        const response = await fetch(SYNC_ENDPOINT, {
            headers: { Accept: "application/json" },
            cache: "no-store"
        });
        if (!response.ok) throw new Error(`Sync unavailable (${response.status})`);

        const payload = await response.json();
        remoteSyncAvailable = true;
        if (payload && payload.updatedAt === null) {
            setSyncStatus("Ready to sync", "synced");
            queueRemoteSave();
        } else if (payload && payload.data) {
            isApplyingRemoteState = true;
            state = normalizeState(payload.data);
            saveState({ sync: false });
            currentUser = loadSession();
            isApplyingRemoteState = false;
            setSyncStatus("Synced", "synced");
            render();
        }
    } catch (error) {
        remoteSyncAvailable = false;
        setSyncStatus("Local only", "local");
    }
}

function queueRemoteSave() {
    if (!remoteSyncAvailable) {
        renderSyncStatus();
        return;
    }

    clearTimeout(remoteSaveTimer);
    setSyncStatus("Saving", "saving");
    remoteSaveTimer = setTimeout(syncStateToServer, 450);
}

async function syncStateToServer() {
    if (!remoteSyncAvailable) return;

    try {
        const response = await fetch(SYNC_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({ data: state })
        });
        if (!response.ok) throw new Error(`Save failed (${response.status})`);
        setSyncStatus("Synced", "synced");
    } catch (error) {
        remoteSyncAvailable = false;
        setSyncStatus("Local only", "error");
    }
}

function setSyncStatus(label, type) {
    syncStatus = { label, type };
    renderSyncStatus();
}

function renderSyncStatus() {
    if (!dom.syncPill) return;
    dom.syncPill.textContent = syncStatus.label;
    dom.syncPill.className = `sync-pill ${syncStatus.type === "synced" ? "" : syncStatus.type}`;
}

function updateSessionUi() {
    if (currentUser.type === "manager") {
        const manager = getCurrentManagerConfig();
        dom.profileAvatar.textContent = manager.shortLabel;
        dom.profileAvatar.style.background = "#1d1d1f";
        dom.profileName.textContent = manager.label;
        dom.profileRole.textContent = manager.role;
        dom.sessionPill.textContent = manager.shortLabel;
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

    const manager = currentUser.type === "manager" ? getCurrentManagerConfig() : null;
    const managerTitle = manager ? manager.title : "Kitchen Schedule";
    const titles = {
        schedule: [manager ? manager.label : "Oak34", managerTitle],
        employeeAvailability: ["Oak34", "My Month"],
        managerAvailability: [manager ? manager.label : "Oak34", "Availability"],
        employees: [manager ? manager.label : "Oak34", "Employees"]
    };
    const [eyebrow, title] = titles[activeView] || titles.schedule;
    dom.surfaceEyebrow.textContent = eyebrow;
    dom.surfaceTitle.textContent = title;
    renderPrintHeading();

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

function renderPrintHeading() {
    const manager = currentUser && currentUser.type === "manager" ? getCurrentManagerConfig() : null;
    const titleMap = {
        schedule: manager ? `Oak34 ${manager.label} Schedule` : "Oak34 Kitchen Schedule",
        employeeAvailability: "Oak34 Kitchen Schedule",
        managerAvailability: manager ? `Oak34 ${manager.label} Availability` : "Oak34 Kitchen Availability",
        employees: manager ? `Oak34 ${manager.label} Team` : "Oak34 Kitchen Team"
    };
    dom.printHeading.textContent = `${titleMap[activeView] || "Calendar"} - ${monthTitle(currentMonth)}`;
}

function exportCurrentViewAsPdf() {
    const useSchedulePacket = currentUser && currentUser.type === "manager" && activeView === "schedule";
    const manager = useSchedulePacket ? getCurrentManagerConfig() : null;
    const exportTitle = useSchedulePacket
        ? `Oak34 ${manager.label} Schedule - ${monthTitle(currentMonth)}`
        : (dom.printHeading.textContent || "Oak34 Kitchen Schedule");

    previousDocumentTitle = document.title;
    document.body.classList.add(useSchedulePacket ? "pdf-packet-exporting" : "pdf-exporting");
    document.title = exportTitle.replace(/\s+/g, "-");
    if (useSchedulePacket) {
        renderSchedulePrintPacket();
    } else {
        renderActiveView();
    }
    setTimeout(() => window.print(), 80);
}

function cleanupPdfExport() {
    if (!document.body.classList.contains("pdf-exporting") && !document.body.classList.contains("pdf-packet-exporting")) return;
    document.body.classList.remove("pdf-exporting");
    document.body.classList.remove("pdf-packet-exporting");
    dom.printPacket.innerHTML = "";
    document.title = previousDocumentTitle;
    renderActiveView();
}

function renderSchedulePrintPacket() {
    const manager = getCurrentManagerConfig();
    const employees = getManagerEmployees();
    const weeks = getMonthWeeks(currentMonth);
    const title = `Oak34 ${manager.label} Schedule`;
    const subtitle = monthTitle(currentMonth);
    const generated = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date());

    dom.printPacket.innerHTML = [
        ...weeks.flatMap((week, index) => renderPrintWeekPages(week, index, manager, employees, title, subtitle, generated)),
        renderPrintTotalsPage(manager, employees, title, subtitle, generated),
        renderPrintCoveragePage(manager, employees, title, subtitle, generated)
    ].join("");
}

function renderPrintPageHeader(title, subtitle, kicker, generated, stats) {
    return `
        <header class="print-page-head">
            <div class="print-title-block">
                <span class="print-logo oak-logo-mark" aria-hidden="true"></span>
                <div>
                    <p>${escapeHtml(kicker)}</p>
                    <h1>${escapeHtml(title)}</h1>
                    <span>${escapeHtml(subtitle)}</span>
                </div>
            </div>
            <div class="print-meta">
                <strong>${escapeHtml(stats)}</strong>
                <span>Generated ${escapeHtml(generated)}</span>
            </div>
        </header>
    `;
}

function renderPrintWeekPages(week, index, manager, employees, title, subtitle, generated) {
    const monthDates = week.filter((date) => isSameMonth(date, currentMonth));
    const printGroups = getPrintEmployeeGroups(employees, manager.area);
    if (!printGroups.length) {
        return [renderPrintWeekPage(week, index, { label: "Team", employees: [] }, monthDates, title, subtitle, generated)];
    }
    return printGroups.map((printGroup) => renderPrintWeekPage(week, index, printGroup, monthDates, title, subtitle, generated));
}

function renderPrintWeekPage(week, index, printGroup, monthDates, title, subtitle, generated) {
    const weekDateKeys = monthDates.map(formatDate);
    const weekStats = getShiftStatsForDates(weekDateKeys, printGroup.employees);
    const stats = `${weekStats.shifts} ${weekStats.shifts === 1 ? "shift" : "shifts"} | ${formatHours(weekStats.minutes)}`;
    const bodyRows = printGroup.employees.length
        ? `
            <tr class="print-group-row">
                <td colspan="8">${escapeHtml(printGroup.label)}</td>
            </tr>
            ${printGroup.employees.map((employee) => renderPrintEmployeeWeekRow(employee, week)).join("")}
        `
        : `<tr><td colspan="8" class="print-empty-row">No employees have been added yet.</td></tr>`;

    return `
        <article class="print-page schedule-week-page">
            ${renderPrintPageHeader(title, subtitle, `Week ${index + 1}: ${formatDateRange(monthDates)} | ${printGroup.label}`, generated, stats)}
            <table class="print-schedule-table">
                <thead>
                    <tr>
                        <th class="print-employee-col">Employee</th>
                        ${week.map((date) => `
                            <th class="${isSameMonth(date, currentMonth) ? "" : "print-outside"}">
                                <span>${escapeHtml(formatPrintWeekday(date))}</span>
                                <strong>${escapeHtml(formatPrintDate(date))}</strong>
                            </th>
                        `).join("")}
                    </tr>
                </thead>
                <tbody>${bodyRows}</tbody>
            </table>
        </article>
    `;
}

function renderPrintEmployeeWeekRow(employee, week) {
    return `
        <tr>
            <th>
                <span class="print-employee-name">${escapeHtml(employee.name)}</span>
                <small>${escapeHtml(employee.role || employeeCategoryLabel(employee))}</small>
            </th>
            ${week.map((date) => {
                const outside = !isSameMonth(date, currentMonth);
                const shifts = outside ? [] : getEmployeeShiftsForDate(employee.id, formatDate(date));
                return `
                    <td class="${outside ? "print-outside" : ""}">
                        ${shifts.length ? shifts.map((shift) => renderPrintShift(shift, employee)).join("") : `<span class="print-empty-cell">-</span>`}
                    </td>
                `;
            }).join("")}
        </tr>
    `;
}

function renderPrintShift(shift, employee) {
    const role = shift.role || employee.role || "Shift";
    const note = shift.note ? `<small>${escapeHtml(shift.note)}</small>` : "";
    return `
        <div class="print-shift" style="--employee-color:${safeAccentColor(employee.color)}">
            <strong>${escapeHtml(shift.start)}-${escapeHtml(shift.end)}</strong>
            <span>${escapeHtml(role)}</span>
            ${note}
        </div>
    `;
}

function renderPrintTotalsPage(manager, employees, title, subtitle, generated) {
    const totals = getMonthlyHoursByEmployee(currentMonth, employees);
    const teamMinutes = totals.reduce((sum, item) => sum + item.minutes, 0);
    const teamShifts = totals.reduce((sum, item) => sum + item.shifts, 0);
    const groups = getGroupedEmployees(employees, manager.area).filter((group) => group.employees.length);
    const groupedTotals = groups.length
        ? groups.map((group) => `
            <tr class="print-group-row">
                <td colspan="5">${escapeHtml(group.label)}</td>
            </tr>
            ${group.employees.map((employee) => {
                const total = totals.find((item) => item.employee.id === employee.id);
                const average = total && total.shifts ? Math.round(total.minutes / total.shifts) : 0;
                return `
                    <tr>
                        <th>${escapeHtml(employee.name)}</th>
                        <td>${escapeHtml(employee.role || employeeCategoryLabel(employee))}</td>
                        <td>${total ? total.shifts : 0}</td>
                        <td>${formatHours(total ? total.minutes : 0)}</td>
                        <td>${average ? formatHours(average) : "-"}</td>
                    </tr>
                `;
            }).join("")}
        `).join("")
        : `<tr><td colspan="5" class="print-empty-row">No employees have been added yet.</td></tr>`;

    return `
        <article class="print-page print-summary-page">
            ${renderPrintPageHeader(title, subtitle, "Monthly employee totals", generated, `${teamShifts} shifts | ${formatHours(teamMinutes)}`)}
            <div class="print-summary-cards">
                <div>
                    <span>Team hours</span>
                    <strong>${formatHours(teamMinutes)}</strong>
                </div>
                <div>
                    <span>Scheduled shifts</span>
                    <strong>${teamShifts}</strong>
                </div>
                <div>
                    <span>Team members</span>
                    <strong>${employees.length}</strong>
                </div>
            </div>
            <table class="print-totals-table">
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Role</th>
                        <th>Shifts</th>
                        <th>Hours</th>
                        <th>Avg shift</th>
                    </tr>
                </thead>
                <tbody>${groupedTotals}</tbody>
            </table>
        </article>
    `;
}

function renderPrintCoveragePage(manager, employees, title, subtitle, generated) {
    const days = getMonthDates(currentMonth);
    const teamStats = getShiftStatsForDates(days.map(formatDate), employees);
    return `
        <article class="print-page print-coverage-page">
            ${renderPrintPageHeader(title, subtitle, "Daily coverage", generated, `${teamStats.shifts} shifts | ${formatHours(teamStats.minutes)}`)}
            <table class="print-coverage-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Shifts</th>
                        <th>Hours</th>
                        <th>Available</th>
                        <th>Maybe</th>
                        <th>Unavailable</th>
                    </tr>
                </thead>
                <tbody>
                    ${days.map((date) => {
                        const dateKey = formatDate(date);
                        const stats = getShiftStatsForDates([dateKey], employees);
                        const availability = getAvailabilitySummary(dateKey, employees);
                        return `
                            <tr>
                                <th>${escapeHtml(formatPrintWeekday(date))} ${escapeHtml(formatPrintDate(date))}</th>
                                <td>${stats.shifts}</td>
                                <td>${formatHours(stats.minutes)}</td>
                                <td>${availability.available}</td>
                                <td>${availability.maybe}</td>
                                <td>${availability.unavailable}</td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </article>
    `;
}

function scrollStrip(container, direction) {
    if (!container) return;
    const distance = Math.max(220, Math.floor(container.clientWidth * 0.75));
    container.scrollBy({ left: distance * direction, behavior: "smooth" });
}

function updateScrollControls() {
    updateHoursScrollControls();
    updateAvailabilityScrollControls();
}

function updateHoursScrollControls() {
    updateScrollerButtons(dom.managerHoursSummary, dom.hoursScrollPrev, dom.hoursScrollNext);
}

function updateAvailabilityScrollControls() {
    updateScrollerButtons(dom.availabilityMatrixWrap, dom.availabilityScrollPrev, dom.availabilityScrollNext);
}

function updateScrollerButtons(container, prevButton, nextButton) {
    if (!container || !prevButton || !nextButton) return;

    const hasOverflow = container.scrollWidth > container.clientWidth + 2;
    prevButton.hidden = !hasOverflow;
    nextButton.hidden = !hasOverflow;
    if (!hasOverflow) return;

    const maxScroll = container.scrollWidth - container.clientWidth;
    prevButton.disabled = container.scrollLeft <= 2;
    nextButton.disabled = container.scrollLeft >= maxScroll - 2;
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
    renderManagerHoursSummary();
    renderCalendar(dom.managerCalendarGrid, "manager");
    dom.managerSelectedDate.textContent = longDate(selectedDate);
    dom.shiftFormMessage.textContent = "";
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
    renderEmployeeHoursSummary(employee.id);
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
    const summary = getAvailabilitySummary(dateKey, getManagerEmployees());
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
    const visibleEmployeeIds = new Set(getManagerEmployees().map((employee) => employee.id));
    const shifts = sortShiftsByStart((state.shifts[dateKey] || []).filter((shift) => visibleEmployeeIds.has(shift.employeeId)));
    if (!shifts.length) return "";

    const totalMinutes = shifts.reduce((sum, shift) => sum + getShiftMinutes(shift), 0);
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
    return [
        `<div class="day-load"><span>${shifts.length} ${shifts.length === 1 ? "shift" : "shifts"}</span><strong>${formatHours(totalMinutes)}</strong></div>`,
        ...visible
    ].join("");
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
    const employees = getManagerEmployees();
    const bookedEmployeeIds = new Set((state.shifts[selectedDate] || []).map((shift) => shift.employeeId));
    const firstAvailableEmployee = employees.find((employee) => !bookedEmployeeIds.has(employee.id));
    if (!employees.length) {
        dom.shiftEmployee.innerHTML = `<option value="">No employees yet</option>`;
        dom.shiftEmployee.disabled = true;
        dom.shiftForm.querySelector(".primary-button").disabled = true;
        return;
    }

    const manager = getCurrentManagerConfig();
    const groups = getGroupedEmployees(employees, manager.area).filter((group) => group.employees.length);
    dom.shiftEmployee.innerHTML = groups.map((group) => `
        <optgroup label="${escapeHtml(group.label)}">
            ${group.employees.map((employee) => {
                const isBooked = bookedEmployeeIds.has(employee.id);
                const optionLabel = isBooked ? `${employee.name} - already scheduled` : employee.name;
                return `<option value="${employee.id}" ${isBooked ? "disabled" : ""}>${escapeHtml(optionLabel)}</option>`;
            }).join("")}
        </optgroup>
    `).join("");
    dom.shiftEmployee.value = firstAvailableEmployee ? firstAvailableEmployee.id : "";
    dom.shiftEmployee.disabled = !firstAvailableEmployee;
    dom.shiftForm.querySelector(".primary-button").disabled = !firstAvailableEmployee;
}

function renderManagerHoursSummary() {
    const employees = getManagerEmployees();
    if (!employees.length) {
        dom.managerHoursSummary.innerHTML = `<p class="empty-state">No employees have been added yet.</p>`;
        requestAnimationFrame(updateHoursScrollControls);
        return;
    }

    const manager = getCurrentManagerConfig();
    const totals = getMonthlyHoursByEmployee(currentMonth, employees);
    const teamMinutes = totals.reduce((sum, item) => sum + item.minutes, 0);
    const teamShifts = totals.reduce((sum, item) => sum + item.shifts, 0);
    const cards = [
        `
            <div class="hours-card total">
                <span class="hours-name">Team total</span>
                <span class="hours-value">${formatHours(teamMinutes)}</span>
                <span class="hours-detail">${escapeHtml(manager.shortLabel)} ${teamShifts} scheduled ${teamShifts === 1 ? "shift" : "shifts"}</span>
            </div>
        `,
        ...totals.map(({ employee, minutes, shifts }) => `
            <div class="hours-card">
                <span class="hours-name">${escapeHtml(employee.name)}</span>
                <span class="hours-value">${formatHours(minutes)}</span>
                <span class="hours-detail">${shifts} ${shifts === 1 ? "shift" : "shifts"} in ${escapeHtml(monthTitle(currentMonth))}</span>
            </div>
        `)
    ];
    dom.managerHoursSummary.innerHTML = cards.join("");
    requestAnimationFrame(updateHoursScrollControls);
}

function renderEmployeeHoursSummary(employeeId) {
    const employee = getEmployee(employeeId);
    const minutes = getEmployeeMonthlyMinutes(employeeId, currentMonth);
    const shifts = getEmployeeMonthlyShiftCount(employeeId, currentMonth);
    dom.employeeHoursSummary.innerHTML = `
        <span class="hours-name">${escapeHtml(monthTitle(currentMonth))}</span>
        <span class="hours-value">${formatHours(minutes)}</span>
        <span class="hours-detail">${escapeHtml(employee.name)} has ${shifts} scheduled ${shifts === 1 ? "shift" : "shifts"}</span>
    `;
}

function renderManagerDayAvailability() {
    const employees = getManagerEmployees();
    if (!employees.length) {
        dom.managerDayAvailability.innerHTML = `<p class="empty-state">No employees have been added yet.</p>`;
        return;
    }

    const manager = getCurrentManagerConfig();
    dom.managerDayAvailability.innerHTML = getGroupedEmployees(employees, manager.area)
        .filter((group) => group.employees.length)
        .map((group) => `
            <div class="availability-group">
                <p class="group-label">${escapeHtml(group.label)}</p>
                ${group.employees.map((employee) => {
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
                }).join("")}
            </div>
        `).join("");
}

function renderDayShifts() {
    const visibleEmployeeIds = new Set(getManagerEmployees().map((employee) => employee.id));
    const shifts = sortShiftsByStart((state.shifts[selectedDate] || []).filter((shift) => visibleEmployeeIds.has(shift.employeeId)));
    if (!shifts.length) {
        dom.dayShiftList.innerHTML = `<p class="empty-state">No shifts for this day.</p>`;
        return;
    }

    const totalMinutes = shifts.reduce((sum, shift) => sum + getShiftMinutes(shift), 0);
    const summary = `
        <div class="list-summary">
            <strong>${shifts.length} ${shifts.length === 1 ? "shift" : "shifts"}</strong>
            <span>${formatHours(totalMinutes)} scheduled</span>
        </div>
    `;
    dom.dayShiftList.innerHTML = summary + shifts.map((shift) => {
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
    const manager = getCurrentManagerConfig();
    const employees = getManagerEmployees();
    const daySize = document.body.classList.contains("pdf-exporting") ? 22 : 28;
    const nameSize = document.body.classList.contains("pdf-exporting") ? 126 : 176;
    dom.availabilityMatrix.style.gridTemplateColumns = `${nameSize}px repeat(${days.length}, ${daySize}px)`;

    const header = [
        `<div class="matrix-day"></div>`,
        ...days.map((date) => `
            <div class="matrix-day">
                <span>${date.getDate()}</span>
            </div>
        `)
    ];

    const rows = getGroupedEmployees(employees, manager.area).flatMap((group) => {
        if (!group.employees.length) return [];
        return [
            `<div class="matrix-group-row">${escapeHtml(group.label)}</div>`,
            ...group.employees.flatMap((employee) => [
                `<div class="matrix-employee">${escapeHtml(employee.name)}</div>`,
                ...days.map((date) => {
                    const availability = getAvailability(employee.id, formatDate(date));
                    const label = availability ? statusShort(availability.status) : "";
                    const title = availability ? `${employee.name}: ${statusLabel(availability.status)}` : `${employee.name}: no entry`;
                    return `<div class="matrix-cell ${availability ? availability.status : ""}" title="${escapeHtml(title)}">${label}</div>`;
                })
            ])
        ];
    });

    dom.availabilityMatrix.innerHTML = employees.length
        ? [...header, ...rows].join("")
        : `<p class="empty-state">No employees have been added yet.</p>`;
    requestAnimationFrame(updateAvailabilityScrollControls);
}

function renderEmployees() {
    const manager = getCurrentManagerConfig();
    const employees = getManagerEmployees();
    dom.employeeCategoryGroup.hidden = manager.area !== "boh";
    dom.employeeCategory.required = manager.area === "boh";
    dom.employeeForm.querySelector("h2").textContent = `Add ${manager.label} employee`;
    dom.employeeForm.querySelector(".eyebrow").textContent = manager.shortLabel;

    dom.employeeList.innerHTML = employees.length
        ? getGroupedEmployees(employees, manager.area).map((group) => {
            if (!group.employees.length) return "";
            return `
                <section class="employee-group">
                    <div class="employee-group-head">
                        <p class="group-label">${escapeHtml(group.label)}</p>
                        <span>${group.employees.length} ${group.employees.length === 1 ? "employee" : "employees"}</span>
                    </div>
                    ${group.employees.map((employee) => {
                        const minutes = getEmployeeMonthlyMinutes(employee.id, currentMonth);
                        const shifts = getEmployeeMonthlyShiftCount(employee.id, currentMonth);
                        return `
                            <div class="employee-row">
                                <div class="employee-meta">
                                    <span class="employee-color" style="background:${employee.color}"></span>
                                    <div>
                                        <p class="employee-name">${escapeHtml(employee.name)}</p>
                                        <p class="employee-sub">${escapeHtml(employee.role || employeeCategoryLabel(employee))}</p>
                                        <p class="employee-hours">${formatHours(minutes)} this month, ${shifts} ${shifts === 1 ? "shift" : "shifts"}</p>
                                    </div>
                                </div>
                                <div class="employee-actions">
                                    ${manager.area === "boh" ? renderEmployeeCategorySelect(employee) : ""}
                                    <span class="code-chip">${escapeHtml(employee.code)}</span>
                                    <button class="danger-button" type="button" data-action="remove-employee" data-id="${employee.id}" aria-label="Remove ${escapeHtml(employee.name)}" title="Remove employee">
                                        <i data-lucide="user-minus"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </section>
            `;
        }).join("")
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
    dom.shiftFormMessage.textContent = "";

    if (hasEmployeeShiftOnDate(employeeId, selectedDate)) {
        const employee = getEmployee(employeeId);
        dom.shiftFormMessage.textContent = `${employee ? employee.name : "This employee"} already has a shift on ${longDate(selectedDate)}.`;
        renderShiftEmployeeOptions();
        return;
    }

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
    dom.shiftFormMessage.textContent = "";
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
    const manager = getCurrentManagerConfig();
    const name = dom.employeeName.value.trim();
    const role = dom.employeeRole.value.trim();
    const code = normalizeCode(dom.employeeCode.value || generateEmployeeCode(name));
    const area = manager.area;
    const category = area === "boh" && isKitchenCategory(dom.employeeCategory.value)
        ? dom.employeeCategory.value
        : "front-of-house";

    if (!name) return;
    if (isManagerCode(code) || state.employees.some((employee) => normalizeCode(employee.code) === code)) {
        dom.employeeFormMessage.textContent = "That access code is already in use.";
        return;
    }

    const employee = {
        id: `emp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        role,
        code,
        color: employeeColors[state.employees.length % employeeColors.length],
        area,
        category
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

function handleEmployeeListChange(event) {
    const select = event.target.closest("[data-action='change-category']");
    if (!select || !isKitchenCategory(select.value)) return;
    const employee = getEmployee(select.dataset.id);
    if (!employee) return;

    employee.area = "boh";
    employee.category = select.value;
    saveState();
    renderEmployees();
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

function hasEmployeeShiftOnDate(employeeId, dateKey) {
    return (state.shifts[dateKey] || []).some((shift) => shift.employeeId === employeeId);
}

function getAvailabilitySummary(dateKey, employees = state.employees) {
    return employees.reduce((summary, employee) => {
        const availability = getAvailability(employee.id, dateKey);
        if (availability) summary[availability.status] += 1;
        return summary;
    }, { available: 0, maybe: 0, unavailable: 0 });
}

function getMonthlyHoursByEmployee(monthDate, employees = state.employees) {
    return employees.map((employee) => ({
        employee,
        minutes: getEmployeeMonthlyMinutes(employee.id, monthDate),
        shifts: getEmployeeMonthlyShiftCount(employee.id, monthDate)
    }));
}

function getEmployeeMonthlyMinutes(employeeId, monthDate) {
    return Object.entries(state.shifts).reduce((total, [dateKey, shifts]) => {
        if (!isSameMonth(parseDate(dateKey), monthDate)) return total;
        return total + shifts
            .filter((shift) => shift.employeeId === employeeId)
            .reduce((sum, shift) => sum + getShiftMinutes(shift), 0);
    }, 0);
}

function getEmployeeMonthlyShiftCount(employeeId, monthDate) {
    return Object.entries(state.shifts).reduce((count, [dateKey, shifts]) => {
        if (!isSameMonth(parseDate(dateKey), monthDate)) return count;
        return count + shifts.filter((shift) => shift.employeeId === employeeId).length;
    }, 0);
}

function getShiftMinutes(shift) {
    const start = timeToMinutes(shift.start);
    const end = timeToMinutes(shift.end);
    if (start === null || end === null || start === end) return 0;
    return end > start ? end - start : end + 24 * 60 - start;
}

function getShiftStatsForDates(dateKeys, employees) {
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const shifts = dateKeys.flatMap((dateKey) => (state.shifts[dateKey] || []).filter((shift) => employeeIds.has(shift.employeeId)));
    return {
        shifts: shifts.length,
        minutes: shifts.reduce((sum, shift) => sum + getShiftMinutes(shift), 0)
    };
}

function getEmployeeShiftsForDate(employeeId, dateKey) {
    return sortShiftsByStart((state.shifts[dateKey] || []).filter((shift) => shift.employeeId === employeeId));
}

function sortShiftsByStart(shifts) {
    return [...shifts].sort((first, second) => {
        const firstStart = timeToMinutes(first.start) ?? Number.MAX_SAFE_INTEGER;
        const secondStart = timeToMinutes(second.start) ?? Number.MAX_SAFE_INTEGER;
        if (firstStart !== secondStart) return firstStart - secondStart;
        const firstEmployee = getEmployee(first.employeeId);
        const secondEmployee = getEmployee(second.employeeId);
        return (firstEmployee ? firstEmployee.name : "").localeCompare(secondEmployee ? secondEmployee.name : "");
    });
}

function timeToMinutes(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(value || "");
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
}

function isSameMonth(date, monthDate) {
    return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
}

function formatHours(minutes) {
    const hours = minutes / 60;
    if (Number.isInteger(hours)) return `${hours}h`;
    return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
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

function getMonthWeeks(monthDate) {
    const cells = getCalendarCells(monthDate);
    const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) => cells.slice(index * 7, index * 7 + 7));
    return weeks.filter((week) => week.some((date) => isSameMonth(date, monthDate)));
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

function formatPrintWeekday(date) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
}

function formatPrintDate(date) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatDateRange(dates) {
    if (!dates.length) return monthTitle(currentMonth);
    return `${formatPrintDate(dates[0])} - ${formatPrintDate(dates[dates.length - 1])}`;
}

function normalizeCode(code) {
    return String(code).trim().replace(/\s+/g, "").toUpperCase();
}

function generateEmployeeCode(name) {
    const prefix = normalizeCode(name).replace(/[^A-Z0-9]/g, "").slice(0, 4) || "EMP";
    let code = "";
    do {
        code = `${prefix}${Math.floor(100 + Math.random() * 900)}`;
    } while (isManagerCode(code) || state.employees.some((employee) => normalizeCode(employee.code) === code));
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

function safeAccentColor(value) {
    return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(value)) ? value : "#9d3448";
}

function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
}
