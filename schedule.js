"use strict";

const STORAGE_KEY = "portfolio2-scheduler-v1";
const SESSION_KEY = "portfolio2-scheduler-session";
const SYNC_ENDPOINT = "/api/scheduler";
const MIN_LOADING_MS = 1850;
const REPEAT_LOADING_MS = 1250;
const MAX_LOADING_MS = 5200;
const LOADER_FINISH_MS = 480;
const LOADER_COMPLETE_HOLD_MS = 220;

const managerAreas = {
    foh: {
        label: "Front of House",
        shortLabel: "FOH",
        managerName: "Chrism",
        managerInitials: "C",
        loginNames: ["Chrism", "Chris M", "Chris Manager"],
        title: "Front of House Schedule",
        role: "Front of House manager"
    },
    boh: {
        label: "Back of House",
        shortLabel: "BOH",
        managerName: "Sander",
        managerInitials: "S",
        loginNames: ["Sander"],
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

const defaultShiftTemplates = [
    { id: "template-boh-open", name: "Kitchen open", area: "boh", role: "Kitchen", start: "10:00", end: "17:00", note: "" },
    { id: "template-boh-dinner", name: "Kitchen dinner", area: "boh", role: "Cook", start: "17:00", end: "23:00", note: "" },
    { id: "template-boh-dish-close", name: "Dish close", area: "boh", role: "Dishwashing", start: "18:00", end: "00:00", note: "" },
    { id: "template-foh-lunch", name: "FOH lunch", area: "foh", role: "Service", start: "11:00", end: "17:00", note: "" },
    { id: "template-foh-dinner", name: "FOH dinner", area: "foh", role: "Service", start: "17:00", end: "23:00", note: "" }
];

const stateTemplate = () => ({
    employees: [
        { id: "emp-alex", name: "Alex Morgan", role: "Chef", code: "ALEX101", color: "#007aff", area: "boh", category: "fulltime", order: 0 },
        { id: "emp-mia", name: "Mia Chen", role: "Part-time cook", code: "MIA204", color: "#34c759", area: "boh", category: "parttime-cook", order: 0 },
        { id: "emp-noah", name: "Noah Pop", role: "Dishwashing", code: "NOAH315", color: "#ff9500", area: "boh", category: "dishwashing", order: 0 }
    ],
    availability: {},
    shifts: {},
    publishedShifts: {},
    publishedAt: {},
    shiftTemplates: defaultShiftTemplates,
    coverageTargets: {},
    confirmations: {},
    swapRequests: []
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
let availabilityBuilderFilter = "available";
let availabilityBuilderSelectedIds = new Set();
let copiedDayShifts = null;
let copiedWeekShifts = null;
let activeShiftEditor = null;
let activeEmployeeProfileId = null;
let loadingDismissed = false;
let loadingAnimationFrame = null;

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
    captureDom();
    prepareFloatingShiftPopover();
    bindEvents();
    render();
    startPremiumLoader(hydrateRemoteState());
});

function captureDom() {
    [
        "loginView",
        "appView",
        "loadingScreen",
        "loaderPercent",
        "loaderProgressLine",
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
        "exportPdfLabel",
        "exportPayrollBtn",
        "exportMode",
        "monthLabel",
        "printHeading",
        "printPacket",
        "managerScheduleView",
        "employeeAvailabilityView",
        "managerAvailabilityView",
        "employeesView",
        "hoursView",
        "managerWeekdays",
        "employeeWeekdays",
        "managerCalendarGrid",
        "employeeCalendarGrid",
        "scheduleMatrixWrap",
        "scheduleMatrix",
        "shiftPopover",
        "shiftPopoverForm",
        "shiftPopoverDate",
        "shiftPopoverEmployee",
        "shiftPopoverMeta",
        "popoverShiftTemplate",
        "popoverShiftStart",
        "popoverShiftEnd",
        "popoverShiftRole",
        "popoverShiftNote",
        "popoverShiftPrivateNote",
        "removePopoverShiftBtn",
        "closeShiftPopoverBtn",
        "shiftPopoverMessage",
        "hoursScrollPrev",
        "hoursScrollNext",
        "managerHoursSummary",
        "managerHoursTable",
        "publishStatus",
        "copyDayBtn",
        "pasteDayBtn",
        "copyWeekBtn",
        "pasteWeekBtn",
        "publishScheduleBtn",
        "scheduleWarnings",
        "weekBuilder",
        "coveragePanel",
        "employeeHoursSummary",
        "managerSelectedDate",
        "employeeSelectedDate",
        "managerDayAvailability",
        "shiftForm",
        "shiftTemplate",
        "shiftEmployee",
        "shiftRole",
        "shiftStart",
        "shiftEnd",
        "shiftNote",
        "shiftPrivateNote",
        "saveShiftTemplateBtn",
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
        "availabilityBuilderSelectedDate",
        "builderPrevDayBtn",
        "builderTodayBtn",
        "builderNextDayBtn",
        "availabilityBuilderStats",
        "availabilityScheduleForm",
        "builderShiftTemplate",
        "builderShiftRole",
        "builderShiftStart",
        "builderShiftEnd",
        "builderShiftNote",
        "builderShiftPrivateNote",
        "builderSelectedCount",
        "builderVisibleCount",
        "availabilityBuilderList",
        "builderSelectShownBtn",
        "builderClearSelectionBtn",
        "builderAddSelectedBtn",
        "availabilityBuilderMessage",
        "employeeForm",
        "employeeName",
        "employeeRole",
        "employeePhoto",
        "employeeEmail",
        "employeePhone",
        "employeeNotes",
        "employeeCategoryGroup",
        "employeeCategory",
        "employeeCode",
        "generateCodeBtn",
        "employeeFormMessage",
        "employeeList",
        "employeeInfoOverlay",
        "employeeInfoForm",
        "employeeInfoPhoto",
        "employeeInfoName",
        "employeeInfoRole",
        "employeeInfoMeta",
        "employeeInfoCode",
        "employeeInfoPhotoInput",
        "employeeInfoEmailInput",
        "employeeInfoPhoneInput",
        "employeeInfoNotes",
        "employeeInfoRemovePhotoBtn",
        "closeEmployeeInfoBtn",
        "employeeInfoMessage"
    ].forEach((id) => {
        dom[id] = document.getElementById(id);
    });
}

function bindEvents() {
    dom.loginForm.addEventListener("submit", handleLogin);
    dom.toggleCodeBtn.addEventListener("click", toggleAccessCode);
    dom.logoutBtn.addEventListener("click", logout);
    dom.prevMonthBtn.addEventListener("click", () => changePeriod(-1));
    dom.nextMonthBtn.addEventListener("click", () => changePeriod(1));
    dom.todayBtn.addEventListener("click", jumpToToday);
    dom.exportPdfBtn.addEventListener("click", exportCurrentViewAsPdf);
    dom.exportPayrollBtn.addEventListener("click", exportPayrollCsv);
    dom.exportMode.addEventListener("change", updateExportControls);
    if (dom.copyDayBtn) dom.copyDayBtn.addEventListener("click", copySelectedDay);
    if (dom.pasteDayBtn) dom.pasteDayBtn.addEventListener("click", pasteCopiedDay);
    if (dom.copyWeekBtn) dom.copyWeekBtn.addEventListener("click", copySelectedWeek);
    if (dom.pasteWeekBtn) dom.pasteWeekBtn.addEventListener("click", pasteCopiedWeek);
    dom.publishScheduleBtn.addEventListener("click", publishCurrentMonth);
    if (dom.hoursScrollPrev) dom.hoursScrollPrev.addEventListener("click", () => scrollStrip(dom.managerHoursSummary, -1));
    if (dom.hoursScrollNext) dom.hoursScrollNext.addEventListener("click", () => scrollStrip(dom.managerHoursSummary, 1));
    if (dom.managerHoursSummary) dom.managerHoursSummary.addEventListener("scroll", updateHoursScrollControls);
    dom.availabilityScrollPrev.addEventListener("click", () => scrollStrip(dom.availabilityMatrixWrap, -1));
    dom.availabilityScrollNext.addEventListener("click", () => scrollStrip(dom.availabilityMatrixWrap, 1));
    dom.availabilityMatrixWrap.addEventListener("scroll", updateAvailabilityScrollControls);
    dom.builderPrevDayBtn.addEventListener("click", () => changeBuilderDay(-1));
    dom.builderTodayBtn.addEventListener("click", jumpBuilderToToday);
    dom.builderNextDayBtn.addEventListener("click", () => changeBuilderDay(1));
    dom.managerAvailabilityView.addEventListener("click", handleManagerAvailabilityClick);
    dom.availabilityBuilderList.addEventListener("change", handleAvailabilityBuilderSelectionChange);
    dom.availabilityScheduleForm.addEventListener("submit", handleAvailabilityScheduleSubmit);
    if (dom.managerCalendarGrid) dom.managerCalendarGrid.addEventListener("click", handleCalendarClick);
    dom.employeeCalendarGrid.addEventListener("click", handleCalendarClick);
    if (dom.scheduleMatrix) dom.scheduleMatrix.addEventListener("click", handleScheduleMatrixClick);
    if (dom.scheduleMatrixWrap) dom.scheduleMatrixWrap.addEventListener("scroll", () => {
        if (activeShiftEditor) positionShiftPopover(activeShiftEditor.anchor);
    });
    if (dom.weekBuilder) dom.weekBuilder.addEventListener("click", handleWeekBuilderClick);
    if (dom.coveragePanel) dom.coveragePanel.addEventListener("change", handleCoverageInput);
    if (dom.shiftForm) dom.shiftForm.addEventListener("submit", handleShiftSubmit);
    if (dom.shiftTemplate) dom.shiftTemplate.addEventListener("change", () => applyShiftTemplate(dom.shiftTemplate.value, "shift"));
    if (dom.saveShiftTemplateBtn) dom.saveShiftTemplateBtn.addEventListener("click", saveCurrentShiftTemplate);
    if (dom.shiftPopoverForm) dom.shiftPopoverForm.addEventListener("submit", handleShiftPopoverSubmit);
    if (dom.popoverShiftTemplate) dom.popoverShiftTemplate.addEventListener("change", () => applyShiftTemplate(dom.popoverShiftTemplate.value, "popover"));
    if (dom.removePopoverShiftBtn) dom.removePopoverShiftBtn.addEventListener("click", removeShiftFromPopover);
    if (dom.closeShiftPopoverBtn) dom.closeShiftPopoverBtn.addEventListener("click", closeShiftPopover);
    dom.availabilityForm.addEventListener("submit", handleAvailabilitySubmit);
    dom.clearAvailabilityBtn.addEventListener("click", clearAvailability);
    dom.builderShiftTemplate.addEventListener("change", () => applyShiftTemplate(dom.builderShiftTemplate.value, "builder"));
    dom.employeeForm.addEventListener("submit", handleEmployeeSubmit);
    dom.generateCodeBtn.addEventListener("click", fillGeneratedEmployeeCode);
    dom.employeeList.addEventListener("click", handleEmployeeListClick);
    dom.employeeList.addEventListener("change", handleEmployeeListChange);
    if (dom.employeeInfoForm) dom.employeeInfoForm.addEventListener("submit", handleEmployeeInfoSubmit);
    if (dom.closeEmployeeInfoBtn) dom.closeEmployeeInfoBtn.addEventListener("click", closeEmployeeInfo);
    if (dom.employeeInfoRemovePhotoBtn) dom.employeeInfoRemovePhotoBtn.addEventListener("click", removeEmployeeInfoPhoto);
    if (dom.employeeInfoOverlay) {
        dom.employeeInfoOverlay.addEventListener("click", (event) => {
            if (event.target === dom.employeeInfoOverlay) closeEmployeeInfo();
        });
    }
    if (dom.dayShiftList) dom.dayShiftList.addEventListener("click", handleShiftListClick);
    dom.employeeDayShifts.addEventListener("click", handleEmployeeShiftClick);
    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("keydown", handleGlobalKeydown);
    window.addEventListener("afterprint", cleanupPdfExport);
    window.addEventListener("resize", updateScrollControls);
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", updateShiftPopoverPosition);
        window.visualViewport.addEventListener("scroll", updateShiftPopoverPosition);
    }

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

function prepareFloatingShiftPopover() {
    if (!dom.shiftPopover || dom.shiftPopover.parentElement === document.body) return;
    document.body.appendChild(dom.shiftPopover);
}

function updateShiftPopoverPosition() {
    if (activeShiftEditor) positionShiftPopover(activeShiftEditor.anchor);
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
    const rawShifts = nextState && nextState.shifts ? nextState.shifts : template.shifts;
    const normalizedShifts = normalizeShiftsByDate(rawShifts);
    const rawPublishedShifts = nextState && nextState.publishedShifts ? nextState.publishedShifts : rawShifts;
    const normalizedState = {
        ...template,
        ...(nextState || {}),
        employees: Array.isArray(nextState && nextState.employees)
            ? nextState.employees.map(normalizeEmployee)
            : template.employees.map(normalizeEmployee),
        availability: nextState && nextState.availability ? nextState.availability : {},
        shifts: normalizedShifts,
        publishedShifts: normalizeShiftsByDate(rawPublishedShifts),
        publishedAt: nextState && nextState.publishedAt ? nextState.publishedAt : {},
        shiftTemplates: normalizeShiftTemplates(nextState && nextState.shiftTemplates),
        coverageTargets: nextState && nextState.coverageTargets ? nextState.coverageTargets : {},
        confirmations: nextState && nextState.confirmations ? nextState.confirmations : {},
        swapRequests: normalizeSwapRequests(nextState && nextState.swapRequests)
    };
    delete normalizedState.managerCode;
    delete normalizedState.managerCodes;
    normalizeEmployeeOrders(normalizedState.employees);
    return normalizedState;
}

function normalizeShiftsByDate(shiftsByDate = {}) {
    return Object.entries(shiftsByDate || {}).reduce((normalized, [dateKey, shifts]) => {
        if (!Array.isArray(shifts)) return normalized;
        const cleanShifts = shifts.map(normalizeShift).filter((shift) => shift.employeeId && shift.start && shift.end);
        if (cleanShifts.length) normalized[dateKey] = cleanShifts;
        return normalized;
    }, {});
}

function normalizeShift(shift = {}) {
    return {
        id: shift.id || `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        employeeId: shift.employeeId || "",
        start: shift.start || "09:00",
        end: shift.end || "17:00",
        role: shift.role || "",
        note: shift.note || "",
        privateNote: shift.privateNote || ""
    };
}

function normalizeShiftTemplates(templates) {
    const incoming = Array.isArray(templates) ? templates : [];
    const merged = [...defaultShiftTemplates, ...incoming].reduce((map, template) => {
        if (!template || !template.id) return map;
        map.set(template.id, {
            id: template.id,
            name: template.name || "Shift template",
            area: managerAreas[template.area] ? template.area : "all",
            role: template.role || "",
            start: template.start || "09:00",
            end: template.end || "17:00",
            note: template.note || "",
            privateNote: template.privateNote || ""
        });
        return map;
    }, new Map());
    return [...merged.values()];
}

function normalizeSwapRequests(requests) {
    return Array.isArray(requests)
        ? requests.map((request) => ({
            id: request.id || `swap-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            shiftId: request.shiftId || "",
            employeeId: request.employeeId || "",
            dateKey: request.dateKey || "",
            message: request.message || "",
            status: ["pending", "approved", "denied"].includes(request.status) ? request.status : "pending",
            createdAt: request.createdAt || new Date().toISOString()
        })).filter((request) => request.shiftId && request.employeeId && request.dateKey)
        : [];
}

function normalizeEmployee(employee) {
    employee = employee || {};
    const area = employee && managerAreas[employee.area] ? employee.area : "boh";
    const category = area === "boh" && isKitchenCategory(employee && employee.category)
        ? employee.category
        : (area === "boh" ? "parttime-cook" : "front-of-house");
    const order = Number(employee.order);

    return {
        ...employee,
        area,
        category,
        order: Number.isFinite(order) ? order : null,
        photo: normalizeEmployeePhoto(employee.photo),
        email: cleanEmployeeText(employee.email),
        phone: cleanEmployeeText(employee.phone),
        notes: cleanEmployeeText(employee.notes)
    };
}

function cleanEmployeeText(value) {
    return String(value || "").trim();
}

function normalizeEmployeePhoto(value) {
    const photo = String(value || "").trim();
    if (!photo) return "";
    return photo.startsWith("data:image/") || /^https?:\/\//i.test(photo) ? photo : "";
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
    return Object.entries(managerAreas)
        .map(([area, config]) => getPersonalManagerCodes(area, config)
            .some((item) => normalizeCode(item) === code) ? { area, ...config } : null)
        .find(Boolean);
}

function getPersonalManagerCodes(area, config = managerAreas[area]) {
    const loginNameCodes = (config.loginNames || []).map(normalizeCode);
    const employeeCodes = state.employees
        .filter((employee) => getEmployeeArea(employee) === area)
        .filter((employee) => {
            const employeeName = normalizeCode(employee.name);
            return loginNameCodes.some((nameCode) => employeeName === nameCode || employeeName.startsWith(nameCode));
        })
        .map((employee) => employee.code);
    return [...employeeCodes, ...loginNameCodes];
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
        const orderDiff = getEmployeeOrder(first) - getEmployeeOrder(second);
        if (orderDiff !== 0) return orderDiff;
        return first.name.localeCompare(second.name);
    });
}

function getEmployeeOrder(employee) {
    const order = Number(employee && employee.order);
    return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function getGroupedEmployees(employees, area = "boh") {
    if (area !== "boh") {
        return [{ id: "foh", label: "Front of House", employees: getSortedEmployees(employees, area) }];
    }

    return kitchenCategories.map((category) => ({
        ...category,
        employees: getSortedEmployees(employees.filter((employee) => getEmployeeCategory(employee) === category.id), area)
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

function normalizeEmployeeOrders(employees = state.employees, areaFilter = null) {
    const areas = areaFilter ? [areaFilter] : Object.keys(managerAreas);
    areas.forEach((area) => {
        const areaEmployees = employees.filter((employee) => getEmployeeArea(employee) === area);
        getGroupedEmployees(areaEmployees, area).forEach((group) => {
            group.employees.forEach((employee, index) => {
                employee.order = index;
            });
        });
    });
}

function getNextEmployeeOrder(area, category, excludedEmployeeId = null) {
    const matchingEmployees = state.employees.filter((employee) => (
        employee.id !== excludedEmployeeId
        && getEmployeeArea(employee) === area
        && (area !== "boh" || getEmployeeCategory(employee) === category)
    ));
    return matchingEmployees.reduce((max, employee) => Math.max(max, getEmployeeOrder(employee)), -1) + 1;
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
        closeEmployeeInfo();
        dom.loginView.hidden = false;
        dom.appView.hidden = true;
        dom.logoutBtn.hidden = true;
        dom.syncPill.hidden = true;
        dom.sessionPill.hidden = true;
        document.body.classList.remove("manager-schedule-view");
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
    updateViewModeClasses();
    renderWeekdays();
    renderMonthLabel();
    renderNavigation();
    renderActiveView();
    refreshIcons();
}

function updateViewModeClasses() {
    document.body.classList.toggle("manager-schedule-view", isManagerScheduleView());
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

function startPremiumLoader(startupPromise) {
    if (!dom.loadingScreen) return;

    const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hasSeenLoader = getSessionFlag("oak34-loader-seen") === "1";
    const minDuration = prefersReducedMotion ? 600 : (hasSeenLoader ? REPEAT_LOADING_MS : MIN_LOADING_MS);
    const maxDuration = prefersReducedMotion ? 2200 : MAX_LOADING_MS;
    const startedAt = performance.now();
    const logoPieces = Array.from(dom.loadingScreen.querySelectorAll(".loader-word-piece"));
    const finalLogo = dom.loadingScreen.querySelector(".loader-word-final");
    const pieceMotion = [
        { x: -48, y: 16, r: -11, s: 0.1, delay: 0 },
        { x: -20, y: -28, r: 7, s: -0.06, delay: 0.04 },
        { x: 12, y: 30, r: -8, s: 0.06, delay: 0.08 },
        { x: 36, y: -22, r: 9, s: -0.05, delay: 0.1 },
        { x: 54, y: 12, r: -10, s: 0.07, delay: 0.13 }
    ];
    let realReady = false;
    let finishStartedAt = null;
    let finishStartProgress = 0;
    let displayedProgress = 0;
    let waitingToExit = false;

    Promise.allSettled([
        startupPromise,
        waitForFonts(),
        waitForLogoAsset()
    ]).then(() => {
        realReady = true;
    });

    function frame(now) {
        const elapsed = now - startedAt;
        if (!finishStartedAt && ((realReady && elapsed >= minDuration) || elapsed >= maxDuration)) {
            finishStartedAt = now;
            finishStartProgress = displayedProgress;
        }

        if (finishStartedAt) {
            const finishProgress = clamp01((now - finishStartedAt) / LOADER_FINISH_MS);
            displayedProgress = finishStartProgress + ((1 - finishStartProgress) * easeOutCubic(finishProgress));
        } else {
            const cap = realReady ? 0.94 : 0.86;
            const timeTarget = realReady
                ? Math.min(cap, (elapsed / minDuration) * 0.94)
                : Math.min(cap, (elapsed / maxDuration) * 0.86);
            displayedProgress += (timeTarget - displayedProgress) * 0.14;
        }

        updatePremiumLoader(displayedProgress, logoPieces, finalLogo, pieceMotion, prefersReducedMotion);

        if (finishStartedAt && displayedProgress >= 0.999) {
            updatePremiumLoader(1, logoPieces, finalLogo, pieceMotion, prefersReducedMotion);
            if (!waitingToExit) {
                waitingToExit = true;
                setSessionFlag("oak34-loader-seen", "1");
                setTimeout(hideLoadingScreen, LOADER_COMPLETE_HOLD_MS);
            }
            return;
        }

        loadingAnimationFrame = requestAnimationFrame(frame);
    }

    updatePremiumLoader(0, logoPieces, finalLogo, pieceMotion, prefersReducedMotion);
    loadingAnimationFrame = requestAnimationFrame(frame);
}

function updatePremiumLoader(progress, logoPieces, finalLogo, pieceMotion, prefersReducedMotion) {
    const percent = Math.round(clamp01(progress) * 100);
    if (dom.loaderPercent) dom.loaderPercent.textContent = `${percent}%`;
    if (dom.loaderProgressLine) dom.loaderProgressLine.style.transform = `scaleX(${clamp01(progress)})`;

    if (prefersReducedMotion) {
        logoPieces.forEach((piece) => {
            piece.style.transform = "none";
            piece.style.opacity = "0";
        });
        if (finalLogo) finalLogo.style.opacity = "1";
        return;
    }

    logoPieces.forEach((piece, index) => {
        const motion = pieceMotion[index] || pieceMotion[0];
        const localProgress = clamp01((progress - motion.delay) / (0.92 - motion.delay));
        const assembled = easeInOutQuint(localProgress);
        const scatter = 1 - assembled;
        const drift = Math.sin((progress * 8) + index) * 1.2 * scatter;
        const lift = Math.cos((progress * 6) + index) * 0.8 * scatter;
        const scale = 1 + (motion.s * scatter);
        piece.style.transform = `translate3d(${(motion.x * scatter) + drift}px, ${(motion.y * scatter) + lift}px, 0) rotate(${motion.r * scatter}deg) scale(${scale})`;
        piece.style.opacity = String(1 - (0.46 * scatter));
    });

    if (finalLogo) finalLogo.style.opacity = "0";
}

function waitForFonts() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return document.fonts.ready;
}

function waitForLogoAsset() {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = resolve;
        image.src = "assets/oak34-logo.png";
        if (image.complete) resolve();
    });
}

function getSessionFlag(key) {
    try {
        return sessionStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function setSessionFlag(key, value) {
    try {
        sessionStorage.setItem(key, value);
    } catch (error) {
        // Ignore storage restrictions; the loader still works without this preference.
    }
}

function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value) {
    return 1 - Math.pow(1 - clamp01(value), 3);
}

function easeInOutQuint(value) {
    const t = clamp01(value);
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - (Math.pow(-2 * t + 2, 5) / 2);
}

function hideLoadingScreen() {
    if (loadingDismissed) return;
    loadingDismissed = true;
    if (loadingAnimationFrame) cancelAnimationFrame(loadingAnimationFrame);

    document.body.classList.add("loading-done");
    document.body.classList.remove("is-loading");
    setTimeout(() => {
        if (dom.loadingScreen) dom.loadingScreen.remove();
    }, 520);
}

function updateSessionUi() {
    if (currentUser.type === "manager") {
        const manager = getCurrentManagerConfig();
        dom.profileAvatar.textContent = manager.managerInitials || manager.shortLabel;
        dom.profileAvatar.style.background = "#1d1d1f";
        dom.profileName.textContent = manager.managerName || manager.label;
        dom.profileRole.textContent = manager.role;
        dom.sessionPill.textContent = manager.managerName || manager.shortLabel;
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
    updateExportControls();
}

function updateExportControls() {
    if (!currentUser) return;
    if (currentUser.type === "employee") {
        dom.exportPdfLabel.textContent = "Export schedule";
        return;
    }

    dom.exportPdfLabel.textContent = dom.exportMode.value === "full"
        ? "Export full PDF"
        : "Export schedule";
}

function renderActiveView() {
    const views = {
        schedule: dom.managerScheduleView,
        employeeAvailability: dom.employeeAvailabilityView,
        managerAvailability: dom.managerAvailabilityView,
        employees: dom.employeesView,
        hours: dom.hoursView
    };

    Object.entries(views).forEach(([name, element]) => {
        if (!element) return;
        element.hidden = name !== activeView;
    });

    const manager = currentUser.type === "manager" ? getCurrentManagerConfig() : null;
    const managerTitle = manager ? manager.title : "Kitchen Schedule";
    const titles = {
        schedule: [manager ? manager.label : "Oak34", managerTitle],
        employeeAvailability: ["Oak34", "My Month"],
        managerAvailability: [manager ? manager.label : "Oak34", "Availability"],
        employees: [manager ? manager.label : "Oak34", "Employees"],
        hours: [manager ? manager.label : "Oak34", "Hours"]
    };
    const [eyebrow, title] = titles[activeView] || titles.schedule;
    dom.surfaceEyebrow.textContent = eyebrow;
    dom.surfaceTitle.textContent = title;
    renderPrintHeading();

    if (activeView === "schedule") renderManagerSchedule();
    if (activeView === "employeeAvailability") renderEmployeeAvailability();
    if (activeView === "managerAvailability") renderAvailabilityMatrix();
    if (activeView === "employees") renderEmployees();
    if (activeView === "hours") renderManagerHoursSummary();
}

function setActiveView(view) {
    closeShiftPopover();
    closeEmployeeInfo();
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
        employees: manager ? `Oak34 ${manager.label} Team` : "Oak34 Kitchen Team",
        hours: manager ? `Oak34 ${manager.label} Hours` : "Oak34 Kitchen Hours"
    };
    dom.printHeading.textContent = `${titleMap[activeView] || "Calendar"} - ${monthTitle(currentMonth)}`;
}

function exportCurrentViewAsPdf() {
    const isManager = currentUser && currentUser.type === "manager";
    const exportMode = isManager ? dom.exportMode.value : "schedule";
    const exportTitle = getPdfExportTitle(exportMode);

    previousDocumentTitle = document.title;
    document.body.classList.add("pdf-packet-exporting");
    document.title = exportTitle.replace(/\s+/g, "-");
    if (isManager) {
        renderManagerSchedulePrintPacket({ includeFullData: exportMode === "full" });
    } else {
        renderEmployeeSchedulePrintPacket();
    }
    setTimeout(() => window.print(), 80);
}

function getPdfExportTitle(exportMode) {
    if (currentUser && currentUser.type === "manager") {
        const manager = getCurrentManagerConfig();
        const reportName = exportMode === "full" ? "Full Report" : "Schedule";
        return `Oak34 ${manager.label} ${reportName} - ${monthTitle(currentMonth)}`;
    }

    const employee = getCurrentEmployee();
    return `Oak34 Schedule - ${employee ? employee.name : "Employee"} - ${monthTitle(currentMonth)}`;
}

function cleanupPdfExport() {
    if (!document.body.classList.contains("pdf-exporting") && !document.body.classList.contains("pdf-packet-exporting")) return;
    document.body.classList.remove("pdf-exporting");
    document.body.classList.remove("pdf-packet-exporting");
    dom.printPacket.innerHTML = "";
    document.title = previousDocumentTitle;
    renderActiveView();
}

function renderManagerSchedulePrintPacket({ includeFullData = false } = {}) {
    const manager = getCurrentManagerConfig();
    const employees = getManagerEmployees();
    const title = `Oak34 ${manager.label} Schedule`;
    const subtitle = monthTitle(currentMonth);
    const generated = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date());

    const pages = [
        renderPrintMonthCalendarPage(manager, employees, title, subtitle, generated, state.shifts),
        ...renderPrintShiftGridPages(manager, employees, title, subtitle, generated, state.shifts),
        ...(includeFullData
            ? [
                renderPrintTotalsPage(manager, employees, title, subtitle, generated),
                renderPrintWorkflowPage(manager, employees, title, subtitle, generated),
                renderPrintCoveragePage(manager, employees, title, subtitle, generated),
                ...renderPrintAvailabilityPages(manager, employees, title, subtitle, generated)
            ]
            : [])
    ];

    dom.printPacket.innerHTML = pages.join("");
}

function renderEmployeeSchedulePrintPacket() {
    const employee = getCurrentEmployee();
    if (!employee) return;

    const manager = {
        area: getEmployeeArea(employee),
        label: employeeCategoryLabel(employee)
    };
    const title = "Oak34 Schedule";
    const subtitle = `${employee.name} - ${monthTitle(currentMonth)}`;
    const generated = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date());

    dom.printPacket.innerHTML = [
        renderPrintMonthCalendarPage(manager, [employee], title, subtitle, generated, state.publishedShifts),
        ...renderPrintShiftGridPages(manager, [employee], title, subtitle, generated, state.publishedShifts)
    ]
        .join("");
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

function renderPrintMonthCalendarPage(manager, employees, title, subtitle, generated, shiftsByDate = state.shifts) {
    const days = getCalendarCells(currentMonth);
    const monthDates = getMonthDates(currentMonth);
    const monthStats = getShiftStatsForDates(monthDates.map(formatDate), employees, shiftsByDate);
    const weeks = chunkArray(days, 7);
    return `
        <article class="print-page print-month-page">
            ${renderPrintPageHeader(title, subtitle, "Monthly calendar", generated, `${monthStats.shifts} shifts | ${formatHours(monthStats.minutes)}`)}
            <div class="print-month-calendar">
                ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<div class="print-month-weekday">${day}</div>`).join("")}
                ${weeks.flatMap((week) => week.map((date) => renderPrintMonthCalendarCell(date, employees, shiftsByDate))).join("")}
            </div>
        </article>
    `;
}

function renderPrintMonthCalendarCell(date, employees, shiftsByDate = state.shifts) {
    const dateKey = formatDate(date);
    const outside = !isSameMonth(date, currentMonth);
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const shifts = outside
        ? []
        : sortShiftsByStart((shiftsByDate[dateKey] || []).filter((shift) => employeeIds.has(shift.employeeId)));
    const visibleShifts = shifts.slice(0, 4);
    return `
        <div class="print-month-cell ${outside ? "print-outside" : ""}">
            <div class="print-month-date">
                <span>${date.getDate()}</span>
                ${shifts.length ? `<strong>${shifts.length}</strong>` : ""}
            </div>
            <div class="print-month-shifts">
                ${visibleShifts.map((shift) => {
                    const employee = getEmployee(shift.employeeId);
                    return `
                        <span>
                            <b>${escapeHtml(shift.start)}</b>
                            ${escapeHtml(employee ? employee.name : "Removed employee")}
                        </span>
                    `;
                }).join("")}
                ${shifts.length > visibleShifts.length ? `<small>+${shifts.length - visibleShifts.length} more</small>` : ""}
            </div>
        </div>
    `;
}

function renderPrintShiftGridPages(manager, employees, title, subtitle, generated, shiftsByDate = state.shifts) {
    const rows = getPrintShiftRows(employees, shiftsByDate);
    const chunks = rows.length ? chunkArray(rows, 28) : [[]];
    return chunks.map((rowsChunk, index) => {
        const pageLabel = chunks.length > 1 ? `Shift grid ${index + 1}/${chunks.length}` : "Shift grid";
        return `
            <article class="print-page print-shift-grid-page">
                ${renderPrintPageHeader(title, subtitle, pageLabel, generated, `${rows.length} ${rows.length === 1 ? "shift" : "shifts"}`)}
                <table class="print-shift-grid-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Day</th>
                            <th>Employee</th>
                            <th>Group</th>
                            <th>Role</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Hours</th>
                            <th>Note</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsChunk.length ? rowsChunk.map((row) => `
                            <tr>
                                <th>${escapeHtml(row.date)}</th>
                                <td>${escapeHtml(row.day)}</td>
                                <td>${escapeHtml(row.employeeName)}</td>
                                <td>${escapeHtml(row.group)}</td>
                                <td>${escapeHtml(row.role)}</td>
                                <td>${escapeHtml(row.start)}</td>
                                <td>${escapeHtml(row.end)}</td>
                                <td>${escapeHtml(row.hours)}</td>
                                <td>${escapeHtml(row.note)}</td>
                            </tr>
                        `).join("") : `<tr><td colspan="9" class="print-empty-row">No shifts scheduled yet.</td></tr>`}
                    </tbody>
                </table>
            </article>
        `;
    });
}

function getPrintShiftRows(employees, shiftsByDate = state.shifts) {
    const employeeIds = new Set(employees.map((employee) => employee.id));
    return Object.entries(shiftsByDate)
        .filter(([dateKey]) => isSameMonth(parseDate(dateKey), currentMonth))
        .flatMap(([dateKey, shifts]) => shifts
            .filter((shift) => employeeIds.has(shift.employeeId))
            .map((shift) => {
                const employee = getEmployee(shift.employeeId);
                const date = parseDate(dateKey);
                return {
                    date: formatPrintDate(date),
                    day: formatPrintWeekday(date),
                    employeeName: employee ? employee.name : "Removed employee",
                    group: employee ? employeeCategoryLabel(employee) : "",
                    role: shift.role || (employee ? employee.role : "Shift"),
                    start: shift.start,
                    end: shift.end,
                    hours: formatHours(getShiftMinutes(shift)),
                    note: shift.note || "",
                    sortKey: `${dateKey}-${shift.start}-${employee ? employee.name : ""}`
                };
            }))
        .sort((first, second) => first.sortKey.localeCompare(second.sortKey));
}

function renderPrintWeekPages(week, index, manager, employees, title, subtitle, generated, shiftsByDate = state.shifts) {
    const monthDates = week.filter((date) => isSameMonth(date, currentMonth));
    const printGroups = getPrintEmployeeGroups(employees, manager.area);
    if (!printGroups.length) {
        return [renderPrintWeekPage(week, index, { label: "Team", employees: [] }, monthDates, title, subtitle, generated, shiftsByDate)];
    }
    return printGroups.map((printGroup) => renderPrintWeekPage(week, index, printGroup, monthDates, title, subtitle, generated, shiftsByDate));
}

function renderPrintWeekPage(week, index, printGroup, monthDates, title, subtitle, generated, shiftsByDate = state.shifts) {
    const weekDateKeys = monthDates.map(formatDate);
    const weekStats = getShiftStatsForDates(weekDateKeys, printGroup.employees, shiftsByDate);
    const stats = `${weekStats.shifts} ${weekStats.shifts === 1 ? "shift" : "shifts"} | ${formatHours(weekStats.minutes)}`;
    const bodyRows = printGroup.employees.length
        ? `
            <tr class="print-group-row">
                <td colspan="8">${escapeHtml(printGroup.label)}</td>
            </tr>
            ${printGroup.employees.map((employee) => renderPrintEmployeeWeekRow(employee, week, shiftsByDate)).join("")}
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

function renderPrintEmployeeWeekRow(employee, week, shiftsByDate = state.shifts) {
    return `
        <tr>
            <th>
                <span class="print-employee-name">${escapeHtml(employee.name)}</span>
                <small>${escapeHtml(employee.role || employeeCategoryLabel(employee))}</small>
            </th>
            ${week.map((date) => {
                const outside = !isSameMonth(date, currentMonth);
                const shifts = outside ? [] : getEmployeeShiftsForDate(employee.id, formatDate(date), shiftsByDate);
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

function renderPrintWorkflowPage(manager, employees, title, subtitle, generated) {
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const shifts = getAreaMonthShifts(state.shifts, manager.area, currentMonth)
        .filter((shift) => employeeIds.has(shift.employeeId))
        .sort((first, second) => `${first.dateKey}-${first.start}`.localeCompare(`${second.dateKey}-${second.start}`));
    const confirmedCount = shifts.filter((shift) => isShiftConfirmed(shift.id, shift.employeeId)).length;
    const pendingSwaps = state.swapRequests.filter((request) => {
        const shift = shifts.find((item) => item.id === request.shiftId);
        return shift && request.status === "pending";
    }).length;

    return `
        <article class="print-page print-summary-page">
            ${renderPrintPageHeader(title, subtitle, "Publish, confirmations, swap requests", generated, `${confirmedCount}/${shifts.length} confirmed | ${pendingSwaps} pending swaps`)}
            <table class="print-totals-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Shift</th>
                        <th>Confirmed</th>
                        <th>Swap requests</th>
                    </tr>
                </thead>
                <tbody>
                    ${shifts.length ? shifts.map((shift) => {
                        const employee = getEmployee(shift.employeeId);
                        const swaps = getSwapRequestsForShift(shift.id);
                        return `
                            <tr>
                                <th>${escapeHtml(shift.dateKey)}</th>
                                <td>${escapeHtml(employee ? employee.name : "Removed employee")}</td>
                                <td>${escapeHtml(`${shift.start}-${shift.end} ${shift.role || "Shift"}`)}</td>
                                <td>${isShiftConfirmed(shift.id, shift.employeeId) ? "Yes" : "No"}</td>
                                <td>${swaps.length ? escapeHtml(swaps.map((request) => request.status).join(", ")) : "-"}</td>
                            </tr>
                        `;
                    }).join("") : `<tr><td colspan="5" class="print-empty-row">No shifts scheduled yet.</td></tr>`}
                </tbody>
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
                        <th>Targets</th>
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
                                <td>${escapeHtml(formatCoverageTargetSummary(dateKey, manager.area))}</td>
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

function renderPrintAvailabilityPages(manager, employees, title, subtitle, generated) {
    const days = getMonthDates(currentMonth);
    const printGroups = getPrintEmployeeGroups(employees, manager.area);
    if (!printGroups.length) {
        return [`
            <article class="print-page print-availability-page">
                ${renderPrintPageHeader(title, subtitle, "Team availability", generated, "No employees")}
                <p class="print-empty-row">No employees have been added yet.</p>
            </article>
        `];
    }

    return printGroups.map((group) => `
        <article class="print-page print-availability-page">
            ${renderPrintPageHeader(title, subtitle, `Availability | ${group.label}`, generated, `${group.employees.length} ${group.employees.length === 1 ? "person" : "people"}`)}
            <table class="print-availability-table">
                <thead>
                    <tr>
                        <th>Employee</th>
                        ${days.map((date) => `<th>${date.getDate()}</th>`).join("")}
                    </tr>
                </thead>
                <tbody>
                    ${group.employees.map((employee) => `
                        <tr>
                            <th>
                                <span class="print-employee-name">${escapeHtml(employee.name)}</span>
                                <small>${escapeHtml(employee.role || employeeCategoryLabel(employee))}</small>
                            </th>
                            ${days.map((date) => renderPrintAvailabilityCell(employee, formatDate(date))).join("")}
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </article>
    `);
}

function renderPrintAvailabilityCell(employee, dateKey) {
    const availability = getAvailability(employee.id, dateKey);
    if (!availability) return `<td class="availability-none">-</td>`;
    return `<td class="${availability.status}">${escapeHtml(statusShort(availability.status))}</td>`;
}

function scrollStrip(container, direction) {
    if (!container) return;
    const distance = Math.max(220, Math.floor(container.clientWidth * 0.75));
    container.scrollBy({ left: distance * direction, behavior: "smooth" });
}

function updateScrollControls() {
    updateHoursScrollControls();
    updateAvailabilityScrollControls();
    if (activeShiftEditor) positionShiftPopover(activeShiftEditor.anchor);
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
    if (dom.managerWeekdays) dom.managerWeekdays.innerHTML = markup;
    dom.employeeWeekdays.innerHTML = markup;
}

function renderMonthLabel() {
    const scheduleWeekMode = isManagerScheduleView();
    const label = scheduleWeekMode
        ? weekTitle(getScheduleGridDates())
        : monthTitle(currentMonth);
    dom.monthLabel.textContent = label;
    dom.prevMonthBtn.setAttribute("aria-label", scheduleWeekMode ? "Previous week" : "Previous month");
    dom.prevMonthBtn.setAttribute("title", scheduleWeekMode ? "Previous week" : "Previous month");
    dom.nextMonthBtn.setAttribute("aria-label", scheduleWeekMode ? "Next week" : "Next month");
    dom.nextMonthBtn.setAttribute("title", scheduleWeekMode ? "Next week" : "Next month");
}

function renderManagerSchedule() {
    renderScheduleWorkflow();
    renderScheduleMatrix();
    renderShiftTemplateOptions();
}

function renderScheduleWorkflow() {
    const manager = getCurrentManagerConfig();
    const key = getPublishKey(manager.area, currentMonth);
    const publishedAt = state.publishedAt[key];
    const draftShifts = getAreaMonthShifts(state.shifts, manager.area, currentMonth).length;
    const publishedShifts = getAreaMonthShifts(state.publishedShifts, manager.area, currentMonth).length;
    const publishDetail = publishedAt
        ? `Published ${formatDateTime(publishedAt)}`
        : "Not published yet";
    const status = arePublishedShiftsCurrent(manager.area, currentMonth)
        ? "Employees are seeing the current schedule."
        : "Draft has unpublished changes.";

    dom.publishStatus.textContent = `${status} Draft ${draftShifts}, published ${publishedShifts}. ${publishDetail}.`;
    if (dom.pasteDayBtn) dom.pasteDayBtn.disabled = !copiedDayShifts;
    if (dom.pasteWeekBtn) dom.pasteWeekBtn.disabled = !copiedWeekShifts;
}

function renderScheduleWarnings() {
    if (!dom.scheduleWarnings) return;
    const warnings = getScheduleWarnings(selectedDate);
    if (!warnings.length) {
        dom.scheduleWarnings.innerHTML = "";
        return;
    }

    const dangerCount = warnings.filter((warning) => warning.severity === "danger").length;
    const noticeCount = warnings.length - dangerCount;
    const summaryText = [
        dangerCount ? `${dangerCount} urgent` : "",
        noticeCount ? `${noticeCount} note${noticeCount === 1 ? "" : "s"}` : ""
    ].filter(Boolean).join(", ");

    dom.scheduleWarnings.innerHTML = `
        <details class="warning-drawer">
            <summary>
                <i data-lucide="${dangerCount ? "circle-alert" : "info"}"></i>
                <strong>Needs attention</strong>
                <span>${escapeHtml(summaryText || `${warnings.length} note${warnings.length === 1 ? "" : "s"}`)}</span>
            </summary>
            <div class="warning-drawer-list">
                ${warnings.map((warning) => `
                    <div class="schedule-warning ${warning.severity || "notice"}">
                        <i data-lucide="${warning.icon || "circle-alert"}"></i>
                        <div>
                            <strong>${escapeHtml(warning.title)}</strong>
                            <span>${escapeHtml(warning.detail)}</span>
                        </div>
                    </div>
                `).join("")}
            </div>
        </details>
    `;
    refreshIcons();
}

function renderCoveragePanel() {
    if (!dom.coveragePanel) return;
    const manager = getCurrentManagerConfig();
    const groups = getCoverageTargetGroups(manager.area);
    const targets = getCoverageTargets(selectedDate, manager.area);
    const counts = getCoverageCounts(selectedDate, manager.area);
    const targetSummary = groups
        .filter((group) => targets[group.id] || counts[group.id])
        .map((group) => `${counts[group.id] || 0}/${targets[group.id] || 0} ${group.label}`)
        .join(", ");
    dom.coveragePanel.innerHTML = `
        <details class="coverage-drawer">
            <summary>
                <div>
                    <p class="eyebrow">Coverage</p>
                    <strong>${escapeHtml(targetSummary || "Set targets")}</strong>
                </div>
                <i data-lucide="chevron-down"></i>
            </summary>
            <div class="coverage-grid">
                ${groups.map((group) => {
                    const target = targets[group.id] || 0;
                    const count = counts[group.id] || 0;
                    const status = target && count < target ? "low" : (target && count > target ? "high" : "ok");
                    return `
                        <label class="coverage-item ${status}">
                            <span>${escapeHtml(group.label)}</span>
                            <input type="number" min="0" step="1" value="${target}" data-coverage-target="${group.id}" aria-label="${escapeHtml(group.label)} target">
                            <small>${count}/${target || 0} scheduled</small>
                        </label>
                    `;
                }).join("")}
            </div>
        </details>
    `;
}

function renderScheduleMatrix() {
    if (!dom.scheduleMatrix) return;

    const days = getScheduleGridDates();
    const manager = getCurrentManagerConfig();
    const employees = getManagerEmployees();
    const nameColumn = document.body.classList.contains("pdf-exporting") ? "126px" : "minmax(150px, 0.8fr)";
    const dayColumn = document.body.classList.contains("pdf-exporting") ? "42px" : "minmax(92px, 1fr)";
    dom.scheduleMatrix.style.gridTemplateColumns = `${nameColumn} repeat(${days.length}, ${dayColumn})`;

    if (!employees.length) {
        dom.scheduleMatrix.innerHTML = `<p class="empty-state">Add employees before building the schedule.</p>`;
        return;
    }

    const header = [
        `<div class="schedule-matrix-name schedule-matrix-corner schedule-week-corner">
            <button class="icon-button schedule-week-grid-btn" type="button" data-action="change-schedule-week" data-delta="-1" aria-label="Previous week" title="Previous week">
                <i data-lucide="chevron-left"></i>
            </button>
            <span>Week</span>
        </div>`,
        ...days.map((date, index) => {
            const isLastDay = index === days.length - 1;
            return `
                <div class="schedule-matrix-day ${isLastDay ? "has-week-next" : ""}">
                    <span>${escapeHtml(formatPrintWeekday(date))}</span>
                    <strong>${date.getDate()}</strong>
                    ${isLastDay ? `
                        <button class="icon-button schedule-week-grid-btn schedule-week-next-btn" type="button" data-action="change-schedule-week" data-delta="1" aria-label="Next week" title="Next week">
                            <i data-lucide="chevron-right"></i>
                        </button>
                    ` : ""}
                </div>
            `;
        })
    ];

    const rows = getGroupedEmployees(employees, manager.area).flatMap((group) => {
        if (!group.employees.length) return [];
        return [
            `<div class="schedule-matrix-group">${escapeHtml(group.label)}</div>`,
            ...group.employees.flatMap((employee) => [
                `<button class="schedule-matrix-name employee-name-trigger" type="button" data-action="view-employee" data-id="${escapeHtml(employee.id)}" aria-label="Open profile for ${escapeHtml(employee.name)}">
                    <strong>${escapeHtml(employee.name)}</strong>
                    <span>${escapeHtml(employee.role || employeeCategoryLabel(employee))}</span>
                </button>`,
                ...days.map((date) => renderScheduleMatrixCell(employee, formatDate(date)))
            ])
        ];
    });

    dom.scheduleMatrix.innerHTML = [...header, ...rows].join("");
    refreshIcons();
}

function renderScheduleMatrixCell(employee, dateKey) {
    const shifts = getEmployeeShiftsForDate(employee.id, dateKey);
    const shift = shifts[0];
    const availability = getAvailability(employee.id, dateKey);
    const scheduled = Boolean(shift);
    const status = scheduled ? "scheduled" : (availability ? availability.status : "none");
    const disabled = !scheduled && availability && availability.status === "unavailable";
    const conflict = scheduled && availability && availability.status === "unavailable";
    const title = scheduled
        ? `${employee.name}: ${shift.start}-${shift.end} ${shift.role || "Shift"}${conflict ? " (marked unavailable)" : ""}`
        : availability
            ? `${employee.name}: ${formatAvailabilityDetail(availability)}`
            : `${employee.name}: no availability entered`;
    const timeHint = availability && availability.start && availability.end ? `${availability.start}-${availability.end}` : "";
    const label = scheduled ? `${shift.start}-${shift.end}` : (statusShort(status) || "-");

    return `
        <button class="schedule-check-cell ${status} ${conflict ? "conflict" : ""} ${disabled ? "disabled" : ""}" type="button" data-action="edit-schedule-cell" data-employee-id="${escapeHtml(employee.id)}" data-date="${escapeHtml(dateKey)}" title="${escapeHtml(title)}" aria-pressed="${scheduled ? "true" : "false"}" aria-label="${escapeHtml(title)}" ${disabled ? "disabled" : ""}>
            <span class="schedule-checkbox ${scheduled ? "checked" : ""}" aria-hidden="true"></span>
            <small>${escapeHtml(label)}</small>
            ${!scheduled && timeHint ? `<em>${escapeHtml(timeHint)}</em>` : ""}
        </button>
    `;
}

function renderWeekBuilder() {
    const manager = getCurrentManagerConfig();
    const employees = getManagerEmployees();
    const week = getWeekDates(parseDate(selectedDate));
    const gridColumns = `minmax(160px, 190px) repeat(7, minmax(118px, 1fr))`;

    if (!employees.length) {
        dom.weekBuilder.innerHTML = `<p class="empty-state">Add employees to use the weekly builder.</p>`;
        return;
    }

    const rows = getGroupedEmployees(employees, manager.area).flatMap((group) => {
        if (!group.employees.length) return [];
        return [
            `<div class="week-builder-group">${escapeHtml(group.label)}</div>`,
            ...group.employees.flatMap((employee) => [
                `<button class="week-builder-employee employee-name-trigger" type="button" data-action="view-employee" data-id="${escapeHtml(employee.id)}" aria-label="Open profile for ${escapeHtml(employee.name)}">
                    <strong>${escapeHtml(employee.name)}</strong>
                    <span>${escapeHtml(formatHours(getWeekMinutesForEmployee(employee.id, week)))}</span>
                </button>`,
                ...week.map((date) => renderWeekBuilderCell(employee, date))
            ])
        ];
    });

    dom.weekBuilder.innerHTML = `
        <details class="week-drawer">
            <summary>
                <div>
                    <p class="eyebrow">Weekly builder</p>
                    <strong>${escapeHtml(formatDateRange(week))}</strong>
                </div>
                <span>Open week grid</span>
            </summary>
            <div class="week-builder-grid" style="grid-template-columns:${gridColumns}">
                <div class="week-builder-corner"></div>
                ${week.map((date) => {
                    const dateKey = formatDate(date);
                    return `
                        <button class="week-builder-day ${dateKey === selectedDate ? "selected" : ""}" type="button" data-date="${dateKey}">
                            <span>${escapeHtml(formatPrintWeekday(date))}</span>
                            <strong>${date.getDate()}</strong>
                        </button>
                    `;
                }).join("")}
                ${rows.join("")}
            </div>
        </details>
    `;
}

function renderWeekBuilderCell(employee, date) {
    const dateKey = formatDate(date);
    const shifts = getEmployeeShiftsForDate(employee.id, dateKey);
    const availability = getAvailability(employee.id, dateKey);
    const status = shifts.length ? "scheduled" : (availability ? availability.status : "none");
    return `
        <button class="week-builder-cell ${status} ${dateKey === selectedDate ? "selected-column" : ""}" type="button" data-date="${dateKey}">
            ${shifts.length
                ? shifts.map((shift) => `<span>${escapeHtml(shift.start)}-${escapeHtml(shift.end)}</span>`).join("")
                : `<small>${escapeHtml(statusShort(status) || "-")}</small>`}
        </button>
    `;
}

function renderShiftTemplateOptions() {
    const manager = getCurrentManagerConfig();
    const templates = getShiftTemplatesForArea(manager.area);
    const options = [
        `<option value="">Custom shift</option>`,
        ...templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)} (${escapeHtml(template.start)}-${escapeHtml(template.end)})</option>`)
    ].join("");
    if (dom.shiftTemplate) dom.shiftTemplate.innerHTML = options;
    if (dom.builderShiftTemplate) dom.builderShiftTemplate.innerHTML = options;
    if (dom.popoverShiftTemplate) dom.popoverShiftTemplate.innerHTML = options;
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
    const shifts = getEmployeeShiftsForDate(employee.id, dateKey, state.publishedShifts);
    return shifts.map((shift) => `
        <div class="shift-pill" style="background:${employee.color}">
            <span>${escapeHtml(shift.start)}-${escapeHtml(shift.end)}</span>
        </div>
    `).join("");
}

function renderShiftEmployeeOptions() {
    if (!dom.shiftEmployee || !dom.shiftForm) return;
    const employees = getManagerEmployees();
    const bookedEmployeeIds = new Set((state.shifts[selectedDate] || []).map((shift) => shift.employeeId));
    const firstAvailableEmployee = employees.find(canSelectAvailabilityBuilderEmployee);
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
                const availability = getAvailability(employee.id, selectedDate);
                const isUnavailable = availability && availability.status === "unavailable";
                const availabilityText = availability ? formatAvailabilityDetail(availability) : "No availability";
                const optionLabel = isBooked
                    ? `${employee.name} - already scheduled`
                    : `${employee.name} - ${availabilityText}`;
                return `<option value="${employee.id}" ${isBooked || isUnavailable ? "disabled" : ""}>${escapeHtml(optionLabel)}</option>`;
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
        if (dom.managerHoursTable) dom.managerHoursTable.innerHTML = "";
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
    if (dom.managerHoursTable) {
        dom.managerHoursTable.innerHTML = `
            <thead>
                <tr>
                    <th>Employee</th>
                    <th>Group</th>
                    <th>Shifts</th>
                    <th>Hours</th>
                    <th>Average</th>
                </tr>
            </thead>
            <tbody>
                ${totals.map(({ employee, minutes, shifts }) => {
                    const average = shifts ? Math.round(minutes / shifts) : 0;
                    return `
                        <tr>
                            <th>${escapeHtml(employee.name)}</th>
                            <td>${escapeHtml(employeeCategoryLabel(employee))}</td>
                            <td>${shifts}</td>
                            <td>${formatHours(minutes)}</td>
                            <td>${average ? formatHours(average) : "-"}</td>
                        </tr>
                    `;
                }).join("")}
            </tbody>
        `;
    }
    requestAnimationFrame(updateHoursScrollControls);
}

function renderEmployeeHoursSummary(employeeId) {
    const employee = getEmployee(employeeId);
    const minutes = getEmployeeMonthlyMinutes(employeeId, currentMonth, state.publishedShifts);
    const shifts = getEmployeeMonthlyShiftCount(employeeId, currentMonth, state.publishedShifts);
    dom.employeeHoursSummary.innerHTML = `
        <span class="hours-name">${escapeHtml(monthTitle(currentMonth))}</span>
        <span class="hours-value">${formatHours(minutes)}</span>
        <span class="hours-detail">${escapeHtml(employee.name)} has ${shifts} published ${shifts === 1 ? "shift" : "shifts"}</span>
    `;
}

function renderManagerDayAvailability() {
    if (!dom.managerDayAvailability) return;
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
                                <button class="availability-name employee-name-trigger" type="button" data-action="view-employee" data-id="${escapeHtml(employee.id)}" aria-label="Open profile for ${escapeHtml(employee.name)}">${escapeHtml(employee.name)}</button>
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
    if (!dom.dayShiftList) return;
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
        const pendingSwap = getSwapRequestsForShift(shift.id).find((request) => request.status === "pending");
        return `
            <div class="mini-shift manager-shift-card" style="background:${color}">
                <span>
                    ${escapeHtml(formatShiftLabel(shift, employee))}
                    ${renderManagerShiftMeta(shift, employee)}
                </span>
                <div class="mini-shift-actions">
                    ${pendingSwap ? `
                        <button type="button" data-action="approve-swap" data-id="${pendingSwap.id}" aria-label="Approve swap request" title="Approve swap request">
                            <i data-lucide="check-check"></i>
                        </button>
                        <button type="button" data-action="deny-swap" data-id="${pendingSwap.id}" aria-label="Deny swap request" title="Deny swap request">
                            <i data-lucide="ban"></i>
                        </button>
                    ` : ""}
                    <button type="button" data-action="remove-shift" data-id="${shift.id}" aria-label="Remove shift" title="Remove shift">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
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
    const shifts = getEmployeeShiftsForDate(employeeId, selectedDate, state.publishedShifts);
    if (!shifts.length) {
        dom.employeeDayShifts.innerHTML = `<p class="empty-state">No published shifts for this day.</p>`;
        return;
    }

    const employee = getEmployee(employeeId);
    dom.employeeDayShifts.innerHTML = shifts.map((shift) => `
        <div class="mini-shift employee-shift-card" style="background:${employee.color}">
            <span>
                ${escapeHtml(shift.start)}-${escapeHtml(shift.end)} ${escapeHtml(shift.role || "Shift")}
                ${shift.note ? `<small>${escapeHtml(shift.note)}</small>` : ""}
                ${renderEmployeeShiftMeta(shift, employee)}
            </span>
            <div class="mini-shift-actions">
                <button type="button" data-action="confirm-shift" data-id="${shift.id}" aria-label="Confirm shift" title="Confirm shift" ${isShiftConfirmed(shift.id, employee.id) ? "disabled" : ""}>
                    <i data-lucide="${isShiftConfirmed(shift.id, employee.id) ? "check-check" : "check"}"></i>
                </button>
                <button type="button" data-action="request-swap" data-id="${shift.id}" aria-label="Request shift swap" title="Request swap" ${getEmployeeSwapRequest(shift.id, employee.id) ? "disabled" : ""}>
                    <i data-lucide="repeat-2"></i>
                </button>
            </div>
        </div>
    `).join("");
    refreshIcons();
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
        ...days.map((date) => {
            const dateKey = formatDate(date);
            const isSelected = dateKey === selectedDate;
            return `
            <button class="matrix-day matrix-day-button ${isSelected ? "selected" : ""}" type="button" data-action="select-availability-date" data-date="${dateKey}">
                <span>${date.getDate()}</span>
            </button>
        `;
        })
    ];

    const rows = getGroupedEmployees(employees, manager.area).flatMap((group) => {
        if (!group.employees.length) return [];
        return [
            `<div class="matrix-group-row">${escapeHtml(group.label)}</div>`,
            ...group.employees.flatMap((employee) => [
                `<button class="matrix-employee employee-name-trigger" type="button" data-action="view-employee" data-id="${escapeHtml(employee.id)}" aria-label="Open profile for ${escapeHtml(employee.name)}">${escapeHtml(employee.name)}</button>`,
                ...days.map((date) => renderAvailabilityMatrixCell(employee, formatDate(date)))
            ])
        ];
    });

    dom.availabilityMatrix.innerHTML = employees.length
        ? [...header, ...rows].join("")
        : `<p class="empty-state">No employees have been added yet.</p>`;
    renderAvailabilityBuilder();
    requestAnimationFrame(updateAvailabilityScrollControls);
}

function renderAvailabilityMatrixCell(employee, dateKey) {
    const availability = getAvailability(employee.id, dateKey);
    const scheduledShifts = getEmployeeShiftsForDate(employee.id, dateKey);
    const scheduled = scheduledShifts.length > 0;
    const canQuickAdd = availability && availability.status === "available" && !scheduled;
    const classes = [
        "matrix-cell",
        canQuickAdd ? "matrix-cell-button" : "",
        availability ? availability.status : "",
        scheduled ? "scheduled" : "",
        dateKey === selectedDate ? "selected-column" : ""
    ].filter(Boolean).join(" ");
    const title = scheduled
        ? `${employee.name}: scheduled ${scheduledShifts.map((shift) => `${shift.start}-${shift.end}`).join(", ")}`
        : availability
            ? `${employee.name}: ${statusLabel(availability.status)}${canQuickAdd ? " - click to add shift" : ""}`
            : `${employee.name}: no entry`;
    const label = scheduled ? "S" : (availability ? statusShort(availability.status) : "");

    if (!canQuickAdd) {
        return `<div class="${classes}" title="${escapeHtml(title)}">${escapeHtml(label)}</div>`;
    }

    return `
        <button class="${classes}" type="button" data-action="quick-add-shift" data-employee-id="${escapeHtml(employee.id)}" data-date="${escapeHtml(dateKey)}" title="${escapeHtml(title)}" aria-label="Add shift for ${escapeHtml(employee.name)} on ${escapeHtml(longDate(dateKey))}">
            ${escapeHtml(label)}
        </button>
    `;
}

function renderAvailabilityBuilder() {
    const manager = getCurrentManagerConfig();
    const employees = getManagerEmployees();
    const visibleEmployees = getAvailabilityBuilderVisibleEmployees(employees);
    const summary = getAvailabilitySummary(selectedDate, employees);
    const scheduledCount = (state.shifts[selectedDate] || []).filter((shift) => employees.some((employee) => employee.id === shift.employeeId)).length;
    const noEntryCount = Math.max(0, employees.length - summary.available - summary.maybe - summary.unavailable);

    availabilityBuilderSelectedIds = new Set([...availabilityBuilderSelectedIds].filter((employeeId) => {
        const employee = getEmployee(employeeId);
        return employee && canSelectAvailabilityBuilderEmployee(employee);
    }));

    dom.availabilityBuilderSelectedDate.textContent = longDate(selectedDate);
    renderShiftTemplateOptions();
    dom.availabilityBuilderStats.innerHTML = [
        renderBuilderStat("Available", summary.available, "available"),
        renderBuilderStat("Maybe", summary.maybe, "maybe"),
        renderBuilderStat("Unavailable", summary.unavailable, "unavailable"),
        renderBuilderStat("No entry", noEntryCount, "none"),
        renderBuilderStat("Scheduled", scheduledCount, "scheduled")
    ].join("");

    document.querySelectorAll("[data-builder-filter]").forEach((button) => {
        button.classList.toggle("active", button.dataset.builderFilter === availabilityBuilderFilter);
    });

    const groups = getGroupedEmployees(visibleEmployees, manager.area).filter((group) => group.employees.length);
    dom.availabilityBuilderList.innerHTML = groups.length
        ? groups.map((group) => `
            <section class="builder-person-group">
                <p class="group-label">${escapeHtml(group.label)}</p>
                ${group.employees.map(renderAvailabilityBuilderPerson).join("")}
            </section>
        `).join("")
        : `<p class="empty-state">No employees match this view.</p>`;

    dom.builderVisibleCount.textContent = `${visibleEmployees.length} shown`;
    dom.builderSelectedCount.textContent = `${availabilityBuilderSelectedIds.size} selected`;
    dom.builderAddSelectedBtn.disabled = availabilityBuilderSelectedIds.size === 0;
    refreshIcons();
}

function renderBuilderStat(label, count, status) {
    return `
        <div class="builder-stat ${status}">
            <span>${escapeHtml(label)}</span>
            <strong>${count}</strong>
        </div>
    `;
}

function renderAvailabilityBuilderPerson(employee) {
    const availability = getAvailability(employee.id, selectedDate);
    const scheduledShifts = getEmployeeShiftsForDate(employee.id, selectedDate);
    const scheduled = scheduledShifts.length > 0;
    const selectable = canSelectAvailabilityBuilderEmployee(employee);
    const selected = availabilityBuilderSelectedIds.has(employee.id);
    const status = scheduled ? "scheduled" : (availability ? availability.status : "none");
    const statusText = scheduled ? "Scheduled" : statusLabel(status);
    const detail = scheduled ? scheduledShifts.map((shift) => `${shift.start}-${shift.end}`).join(", ") : formatAvailabilityDetail(availability);

    return `
        <label class="builder-person ${status} ${selected ? "selected" : ""} ${selectable ? "" : "disabled"}">
            <input type="checkbox" value="${escapeHtml(employee.id)}" data-builder-checkbox ${selected ? "checked" : ""} ${selectable ? "" : "disabled"}>
            ${renderEmployeeAvatar(employee, "employee-picker-photo")}
            <span class="builder-person-main">
                <strong>${escapeHtml(employee.name)}</strong>
                <small>${escapeHtml(employee.role || employeeCategoryLabel(employee))}</small>
            </span>
            <span class="builder-person-status">
                <b>${escapeHtml(statusText)}</b>
                <small>${escapeHtml(detail)}</small>
            </span>
        </label>
    `;
}

function getAvailabilityBuilderVisibleEmployees(employees = getManagerEmployees()) {
    return employees.filter((employee) => {
        const availability = getAvailability(employee.id, selectedDate);
        const scheduled = hasEmployeeShiftOnDate(employee.id, selectedDate);
        if (availabilityBuilderFilter === "available") return availability && availability.status === "available" && !scheduled;
        if (availabilityBuilderFilter === "flexible") return availability && ["available", "maybe"].includes(availability.status) && !scheduled;
        if (availabilityBuilderFilter === "unscheduled") return !scheduled;
        return true;
    });
}

function canSelectAvailabilityBuilderEmployee(employee) {
    const availability = getAvailability(employee.id, selectedDate);
    return !hasEmployeeShiftOnDate(employee.id, selectedDate) && (!availability || availability.status !== "unavailable");
}

function canQuickAddAvailabilityShift(employee, dateKey) {
    const availability = getAvailability(employee.id, dateKey);
    return Boolean(
        employee
        && availability
        && availability.status === "available"
        && !hasEmployeeShiftOnDate(employee.id, dateKey)
    );
}

function formatAvailabilityDetail(availability) {
    if (!availability) return "No availability added";
    const time = availability.start && availability.end ? `${availability.start}-${availability.end}` : "";
    return [statusLabel(availability.status), time, availability.note].filter(Boolean).join(", ");
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
                    ${group.employees.map((employee, index) => {
                        const minutes = getEmployeeMonthlyMinutes(employee.id, currentMonth);
                        const shifts = getEmployeeMonthlyShiftCount(employee.id, currentMonth);
                        const canMoveUp = index > 0;
                        const canMoveDown = index < group.employees.length - 1;
                        return `
                            <div class="employee-row">
                                <button class="employee-profile-trigger" type="button" data-action="view-employee" data-id="${escapeHtml(employee.id)}" aria-label="Open profile for ${escapeHtml(employee.name)}">
                                    ${renderEmployeeAvatar(employee, "employee-photo")}
                                    <div>
                                        <p class="employee-name">${escapeHtml(employee.name)}</p>
                                        <p class="employee-sub">${escapeHtml(employee.role || employeeCategoryLabel(employee))}</p>
                                        <p class="employee-hours">${formatHours(minutes)} this month, ${shifts} ${shifts === 1 ? "shift" : "shifts"}</p>
                                        <p class="employee-contact-preview">${escapeHtml(getEmployeeContactSummary(employee))}</p>
                                    </div>
                                </button>
                                <div class="employee-actions">
                                    <div class="employee-reorder" aria-label="Reorder ${escapeHtml(employee.name)}">
                                        <button class="icon-button reorder-button" type="button" data-action="move-employee" data-direction="-1" data-id="${employee.id}" aria-label="Move ${escapeHtml(employee.name)} up" title="Move up" ${canMoveUp ? "" : "disabled"}>
                                            <i data-lucide="chevron-up"></i>
                                        </button>
                                        <button class="icon-button reorder-button" type="button" data-action="move-employee" data-direction="1" data-id="${employee.id}" aria-label="Move ${escapeHtml(employee.name)} down" title="Move down" ${canMoveDown ? "" : "disabled"}>
                                            <i data-lucide="chevron-down"></i>
                                        </button>
                                    </div>
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
    setSelectedDate(parseDate(cell.dataset.date));
}

function handleManagerAvailabilityClick(event) {
    const profileButton = event.target.closest("[data-action='view-employee']");
    if (profileButton) {
        openEmployeeInfo(profileButton.dataset.id);
        return;
    }

    const quickAddButton = event.target.closest("[data-action='quick-add-shift']");
    if (quickAddButton) {
        quickAddAvailabilityShift(quickAddButton.dataset.employeeId, quickAddButton.dataset.date);
        return;
    }

    const dateButton = event.target.closest("[data-action='select-availability-date']");
    if (dateButton) {
        setSelectedDate(parseDate(dateButton.dataset.date));
        return;
    }

    const filterButton = event.target.closest("[data-builder-filter]");
    if (filterButton) {
        availabilityBuilderFilter = filterButton.dataset.builderFilter;
        availabilityBuilderSelectedIds.clear();
        dom.availabilityBuilderMessage.textContent = "";
        renderAvailabilityBuilder();
        return;
    }

    if (event.target.closest("#builderSelectShownBtn")) {
        availabilityBuilderSelectedIds = new Set(
            getAvailabilityBuilderVisibleEmployees()
                .filter(canSelectAvailabilityBuilderEmployee)
                .map((employee) => employee.id)
        );
        dom.availabilityBuilderMessage.textContent = "";
        renderAvailabilityBuilder();
        return;
    }

    if (event.target.closest("#builderClearSelectionBtn")) {
        availabilityBuilderSelectedIds.clear();
        dom.availabilityBuilderMessage.textContent = "";
        renderAvailabilityBuilder();
    }
}

function handleScheduleMatrixClick(event) {
    const profileButton = event.target.closest("[data-action='view-employee']");
    if (profileButton) {
        openEmployeeInfo(profileButton.dataset.id);
        return;
    }

    const weekButton = event.target.closest("[data-action='change-schedule-week']");
    if (weekButton) {
        changeWeek(Number(weekButton.dataset.delta));
        return;
    }

    const cellButton = event.target.closest("[data-action='edit-schedule-cell']");
    if (!cellButton) return;
    openShiftPopover(cellButton.dataset.employeeId, cellButton.dataset.date, cellButton);
}

function openShiftPopover(employeeId, dateKey, anchor) {
    const employee = getEmployee(employeeId);
    const manager = getCurrentManagerConfig();
    if (!employee || getEmployeeArea(employee) !== manager.area) return;

    selectedDate = dateKey;
    currentMonth = startOfMonth(parseDate(dateKey));
    availabilityBuilderSelectedIds.clear();
    renderMonthLabel();

    const availability = getAvailability(employee.id, dateKey);
    const shift = getEmployeeShiftsForDate(employee.id, dateKey)[0];
    if (!shift && availability && availability.status === "unavailable") {
        return;
    }

    activeShiftEditor = {
        employeeId: employee.id,
        dateKey,
        shiftId: shift ? shift.id : null,
        anchor
    };

    renderShiftTemplateOptions();
    dom.shiftPopoverDate.textContent = `${formatPrintWeekday(parseDate(dateKey))} ${formatPrintDate(parseDate(dateKey))}`;
    dom.shiftPopoverEmployee.textContent = employee.name;
    dom.shiftPopoverMeta.textContent = availability ? formatAvailabilityDetail(availability) : "No availability added";
    dom.popoverShiftTemplate.value = "";
    dom.popoverShiftStart.value = shift ? shift.start : (availability && availability.start ? availability.start : "09:00");
    dom.popoverShiftEnd.value = shift ? shift.end : (availability && availability.end ? availability.end : "17:00");
    dom.popoverShiftRole.value = shift ? shift.role : (employee.role || employeeCategoryLabel(employee));
    dom.popoverShiftNote.value = shift ? shift.note : "";
    dom.popoverShiftPrivateNote.value = shift ? shift.privateNote : "";
    dom.shiftPopoverMessage.textContent = "";
    dom.removePopoverShiftBtn.hidden = !shift;
    dom.shiftPopover.hidden = false;
    requestAnimationFrame(() => {
        positionShiftPopover(anchor);
        dom.popoverShiftStart.focus();
    });
    refreshIcons();
}

function handleShiftPopoverSubmit(event) {
    event.preventDefault();
    if (!activeShiftEditor) return;

    const { employeeId, dateKey, shiftId } = activeShiftEditor;
    const employee = getEmployee(employeeId);
    if (!employee) {
        closeShiftPopover();
        renderManagerSchedule();
        return;
    }

    const availability = getAvailability(employeeId, dateKey);
    if (!shiftId && availability && availability.status === "unavailable") {
        dom.shiftPopoverMessage.textContent = `${employee.name} is unavailable on ${longDate(dateKey)}.`;
        return;
    }

    const start = dom.popoverShiftStart.value;
    const end = dom.popoverShiftEnd.value;
    if (timeToMinutes(start) === null || timeToMinutes(end) === null || start === end) {
        dom.shiftPopoverMessage.textContent = "Add a valid start and end time.";
        return;
    }

    const existingShifts = state.shifts[dateKey] || [];
    const existingShift = shiftId ? existingShifts.find((shift) => shift.id === shiftId) : null;
    if (!existingShift && hasEmployeeShiftOnDate(employeeId, dateKey)) {
        dom.shiftPopoverMessage.textContent = `${employee.name} already has a shift on ${longDate(dateKey)}.`;
        return;
    }

    if (existingShift) {
        existingShift.start = start;
        existingShift.end = end;
        existingShift.role = dom.popoverShiftRole.value.trim();
        existingShift.note = dom.popoverShiftNote.value.trim();
        existingShift.privateNote = dom.popoverShiftPrivateNote.value.trim();
        delete state.confirmations[existingShift.id];
        state.swapRequests = state.swapRequests.filter((request) => request.shiftId !== existingShift.id);
    } else {
        const shift = createShift({
            employeeId,
            start,
            end,
            role: dom.popoverShiftRole.value.trim(),
            note: dom.popoverShiftNote.value.trim(),
            privateNote: dom.popoverShiftPrivateNote.value.trim()
        });
        state.shifts[dateKey] = [...existingShifts, shift];
    }

    saveState();
    closeShiftPopover();
    renderManagerSchedule();
}

function removeShiftFromPopover() {
    if (!activeShiftEditor) return;
    const { employeeId, dateKey, shiftId } = activeShiftEditor;
    if (shiftId) {
        removeShiftById(dateKey, shiftId);
    } else {
        removeEmployeeShiftsOnDate(employeeId, dateKey);
    }
    saveState();
    closeShiftPopover();
    renderManagerSchedule();
}

function positionShiftPopover(anchor) {
    if (!dom.shiftPopover || !anchor || dom.shiftPopover.hidden) return;
    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = dom.shiftPopover.getBoundingClientRect();
    const gap = 8;
    const margin = 12;
    const viewportBounds = getViewportBounds();
    const minLeft = viewportBounds.left + margin;
    const maxLeft = Math.max(minLeft, viewportBounds.right - popoverRect.width - margin);
    const minTop = viewportBounds.top + margin;
    const maxTop = Math.max(minTop, viewportBounds.bottom - popoverRect.height - margin);
    const fitsRight = anchorRect.right + gap + popoverRect.width <= viewportBounds.right - margin;
    const fitsLeft = anchorRect.left - gap - popoverRect.width >= viewportBounds.left + margin;
    let left;
    let top = anchorRect.bottom + gap;

    if (fitsRight && !fitsLeft) {
        left = anchorRect.right + gap;
    } else if (fitsLeft && !fitsRight) {
        left = anchorRect.left - popoverRect.width - gap;
    } else {
        left = anchorRect.left + (anchorRect.width / 2) - (popoverRect.width / 2);
    }

    left = Math.min(Math.max(left, minLeft), maxLeft);
    if (top > maxTop) {
        top = anchorRect.top - popoverRect.height - gap;
    }
    top = Math.min(Math.max(top, minTop), maxTop);

    dom.shiftPopover.style.left = `${left}px`;
    dom.shiftPopover.style.top = `${top}px`;
}

function getViewportBounds() {
    const viewport = window.visualViewport;
    const widthCandidates = [
        window.innerWidth,
        document.documentElement.clientWidth,
        viewport ? viewport.width : null
    ].filter((value) => Number.isFinite(value) && value > 0);
    const heightCandidates = [
        window.innerHeight,
        document.documentElement.clientHeight,
        viewport ? viewport.height : null
    ].filter((value) => Number.isFinite(value) && value > 0);
    const width = Math.min(...widthCandidates);
    const height = Math.min(...heightCandidates);
    const left = viewport ? viewport.offsetLeft : 0;
    const top = viewport ? viewport.offsetTop : 0;

    return {
        left,
        top,
        right: left + width,
        bottom: top + height
    };
}

function closeShiftPopover() {
    if (!dom.shiftPopover) return;
    dom.shiftPopover.hidden = true;
    dom.shiftPopover.style.left = "";
    dom.shiftPopover.style.top = "";
    activeShiftEditor = null;
    if (dom.shiftPopoverMessage) dom.shiftPopoverMessage.textContent = "";
}

function handleDocumentClick(event) {
    if (!dom.shiftPopover || dom.shiftPopover.hidden) return;
    if (event.target.closest("#shiftPopover") || event.target.closest("[data-action='edit-schedule-cell']")) return;
    closeShiftPopover();
}

function handleGlobalKeydown(event) {
    if (event.key !== "Escape") return;
    closeShiftPopover();
    closeEmployeeInfo();
}

function removeEmployeeShiftsOnDate(employeeId, dateKey) {
    const shifts = state.shifts[dateKey] || [];
    const removedIds = shifts.filter((shift) => shift.employeeId === employeeId).map((shift) => shift.id);
    state.shifts[dateKey] = shifts.filter((shift) => shift.employeeId !== employeeId);
    if (!state.shifts[dateKey].length) delete state.shifts[dateKey];
    removedIds.forEach((shiftId) => {
        delete state.confirmations[shiftId];
    });
    state.swapRequests = state.swapRequests.filter((request) => !removedIds.includes(request.shiftId));
}

function removeShiftById(dateKey, shiftId) {
    const shifts = state.shifts[dateKey] || [];
    state.shifts[dateKey] = shifts.filter((shift) => shift.id !== shiftId);
    if (!state.shifts[dateKey].length) delete state.shifts[dateKey];
    delete state.confirmations[shiftId];
    state.swapRequests = state.swapRequests.filter((request) => request.shiftId !== shiftId);
}

function quickAddAvailabilityShift(employeeId, dateKey) {
    const employee = getEmployee(employeeId);
    const manager = getCurrentManagerConfig();
    if (!employee || getEmployeeArea(employee) !== manager.area) return;

    selectedDate = dateKey;
    currentMonth = startOfMonth(parseDate(dateKey));
    availabilityBuilderSelectedIds.clear();
    renderMonthLabel();

    if (!canQuickAddAvailabilityShift(employee, dateKey)) {
        dom.availabilityBuilderMessage.textContent = hasEmployeeShiftOnDate(employee.id, dateKey)
            ? `${employee.name} already has a shift on ${longDate(dateKey)}.`
            : `${employee.name} is not marked available on ${longDate(dateKey)}.`;
        renderAvailabilityMatrix();
        return;
    }

    const shift = createShift({
        employeeId: employee.id,
        start: dom.builderShiftStart.value || "09:00",
        end: dom.builderShiftEnd.value || "17:00",
        role: dom.builderShiftRole.value.trim(),
        note: dom.builderShiftNote.value.trim(),
        privateNote: dom.builderShiftPrivateNote.value.trim()
    });

    state.shifts[dateKey] = [...(state.shifts[dateKey] || []), shift];
    saveState();
    renderAvailabilityMatrix();
    dom.availabilityBuilderMessage.textContent = `Added ${employee.name} on ${longDate(dateKey)} from ${shift.start} to ${shift.end}.`;
}

function handleAvailabilityBuilderSelectionChange(event) {
    const checkbox = event.target.closest("[data-builder-checkbox]");
    if (!checkbox) return;

    if (checkbox.checked) {
        availabilityBuilderSelectedIds.add(checkbox.value);
    } else {
        availabilityBuilderSelectedIds.delete(checkbox.value);
    }
    dom.availabilityBuilderMessage.textContent = "";
    renderAvailabilityBuilder();
}

function handleAvailabilityScheduleSubmit(event) {
    event.preventDefault();
    const selectedEmployees = [...availabilityBuilderSelectedIds]
        .map(getEmployee)
        .filter((employee) => employee && canSelectAvailabilityBuilderEmployee(employee));

    if (!selectedEmployees.length) {
        dom.availabilityBuilderMessage.textContent = "Select at least one available employee.";
        renderAvailabilityBuilder();
        return;
    }

    const newShifts = selectedEmployees.map((employee) => createShift({
        employeeId: employee.id,
        start: dom.builderShiftStart.value,
        end: dom.builderShiftEnd.value,
        role: dom.builderShiftRole.value.trim(),
        note: dom.builderShiftNote.value.trim(),
        privateNote: dom.builderShiftPrivateNote.value.trim()
    }));

    state.shifts[selectedDate] = [...(state.shifts[selectedDate] || []), ...newShifts];
    saveState();
    availabilityBuilderSelectedIds.clear();
    dom.builderShiftNote.value = "";
    dom.builderShiftPrivateNote.value = "";
    renderAvailabilityMatrix();
    dom.availabilityBuilderMessage.textContent = `Added ${newShifts.length} ${newShifts.length === 1 ? "shift" : "shifts"} for ${longDate(selectedDate)}.`;
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

    const availability = getAvailability(employeeId, selectedDate);
    if (availability && availability.status === "unavailable") {
        const employee = getEmployee(employeeId);
        dom.shiftFormMessage.textContent = `${employee ? employee.name : "This employee"} is unavailable on ${longDate(selectedDate)}.`;
        renderShiftEmployeeOptions();
        return;
    }

    const shift = createShift({
        employeeId,
        start: dom.shiftStart.value,
        end: dom.shiftEnd.value,
        role: dom.shiftRole.value.trim(),
        note: dom.shiftNote.value.trim(),
        privateNote: dom.shiftPrivateNote.value.trim()
    });

    state.shifts[selectedDate] = [...(state.shifts[selectedDate] || []), shift];
    saveState();
    dom.shiftNote.value = "";
    dom.shiftPrivateNote.value = "";
    dom.shiftFormMessage.textContent = "";
    renderManagerSchedule();
}

function handleShiftListClick(event) {
    const swapButton = event.target.closest("[data-action='approve-swap'], [data-action='deny-swap']");
    if (swapButton) {
        updateSwapRequestStatus(swapButton.dataset.id, swapButton.dataset.action === "approve-swap" ? "approved" : "denied");
        return;
    }

    const button = event.target.closest("[data-action='remove-shift']");
    if (!button) return;
    const shifts = state.shifts[selectedDate] || [];
    state.shifts[selectedDate] = shifts.filter((shift) => shift.id !== button.dataset.id);
    if (!state.shifts[selectedDate].length) delete state.shifts[selectedDate];
    state.swapRequests = state.swapRequests.filter((request) => request.shiftId !== button.dataset.id);
    delete state.confirmations[button.dataset.id];
    saveState();
    renderManagerSchedule();
}

function handleEmployeeShiftClick(event) {
    const employee = getCurrentEmployee();
    if (!employee) return;

    const confirmButton = event.target.closest("[data-action='confirm-shift']");
    if (confirmButton) {
        confirmShift(confirmButton.dataset.id, employee.id);
        return;
    }

    const swapButton = event.target.closest("[data-action='request-swap']");
    if (swapButton) {
        requestShiftSwap(swapButton.dataset.id, employee.id);
    }
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

async function handleEmployeeSubmit(event) {
    event.preventDefault();
    const manager = getCurrentManagerConfig();
    const name = dom.employeeName.value.trim();
    const role = dom.employeeRole.value.trim();
    const email = cleanEmployeeText(dom.employeeEmail.value);
    const phone = cleanEmployeeText(dom.employeePhone.value);
    const notes = cleanEmployeeText(dom.employeeNotes.value);
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

    let photo = "";
    try {
        photo = await readEmployeePhotoInput(dom.employeePhoto);
    } catch (error) {
        dom.employeeFormMessage.textContent = error.message;
        return;
    }

    const employee = {
        id: `emp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        role,
        photo,
        email,
        phone,
        notes,
        code,
        color: employeeColors[state.employees.length % employeeColors.length],
        area,
        category,
        order: getNextEmployeeOrder(area, category)
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
    const moveButton = event.target.closest("[data-action='move-employee']");
    if (moveButton) {
        moveEmployee(moveButton.dataset.id, Number(moveButton.dataset.direction));
        return;
    }

    const removeButton = event.target.closest("[data-action='remove-employee']");
    if (removeButton) {
        removeEmployee(removeButton.dataset.id);
        return;
    }

    const profileButton = event.target.closest("[data-action='view-employee']");
    if (profileButton) openEmployeeInfo(profileButton.dataset.id);
}

function handleEmployeeListChange(event) {
    const select = event.target.closest("[data-action='change-category']");
    if (!select || !isKitchenCategory(select.value)) return;
    const employee = getEmployee(select.dataset.id);
    if (!employee) return;

    if (getEmployeeCategory(employee) === select.value) return;
    employee.area = "boh";
    employee.category = select.value;
    employee.order = getNextEmployeeOrder("boh", select.value, employee.id);
    normalizeEmployeeOrders(state.employees, "boh");
    saveState();
    renderEmployees();
}

function canOpenEmployeeProfile(employee) {
    if (!employee || !currentUser) return false;
    if (currentUser.type === "manager") return getEmployeeArea(employee) === getCurrentManagerArea();
    return currentUser.type === "employee" && currentUser.employeeId === employee.id;
}

function openEmployeeInfo(employeeId) {
    const employee = getEmployee(employeeId);
    if (!canOpenEmployeeProfile(employee)) return;
    closeShiftPopover();
    activeEmployeeProfileId = employee.id;
    renderEmployeeInfo(employee);
    dom.employeeInfoOverlay.hidden = false;
    requestAnimationFrame(() => dom.closeEmployeeInfoBtn.focus());
    refreshIcons();
}

function renderEmployeeInfo(employee) {
    const minutes = getEmployeeMonthlyMinutes(employee.id, currentMonth);
    const shifts = getEmployeeMonthlyShiftCount(employee.id, currentMonth);
    dom.employeeInfoPhoto.innerHTML = renderEmployeeAvatar(employee, "employee-info-avatar-image");
    dom.employeeInfoName.textContent = employee.name;
    dom.employeeInfoRole.textContent = employee.role || employeeCategoryLabel(employee);
    dom.employeeInfoMeta.textContent = `${employeeCategoryLabel(employee)} - ${formatHours(minutes)} this month, ${shifts} ${shifts === 1 ? "shift" : "shifts"}`;
    dom.employeeInfoCode.textContent = employee.code || "";
    dom.employeeInfoEmailInput.value = employee.email || "";
    dom.employeeInfoPhoneInput.value = employee.phone || "";
    dom.employeeInfoNotes.value = employee.notes || "";
    dom.employeeInfoPhotoInput.value = "";
    dom.employeeInfoRemovePhotoBtn.hidden = !employee.photo;
    dom.employeeInfoMessage.textContent = "";
}

async function handleEmployeeInfoSubmit(event) {
    event.preventDefault();
    const employee = getEmployee(activeEmployeeProfileId);
    if (!employee || !canOpenEmployeeProfile(employee)) {
        closeEmployeeInfo();
        return;
    }

    try {
        const photo = await readEmployeePhotoInput(dom.employeeInfoPhotoInput);
        if (photo) employee.photo = photo;
    } catch (error) {
        dom.employeeInfoMessage.textContent = error.message;
        return;
    }

    employee.email = cleanEmployeeText(dom.employeeInfoEmailInput.value);
    employee.phone = cleanEmployeeText(dom.employeeInfoPhoneInput.value);
    employee.notes = cleanEmployeeText(dom.employeeInfoNotes.value);
    saveState();
    renderActiveView();
    renderEmployeeInfo(employee);
    dom.employeeInfoMessage.textContent = "Profile saved.";
}

function removeEmployeeInfoPhoto() {
    const employee = getEmployee(activeEmployeeProfileId);
    if (!employee || !canOpenEmployeeProfile(employee)) return;
    employee.photo = "";
    saveState();
    renderActiveView();
    renderEmployeeInfo(employee);
    dom.employeeInfoMessage.textContent = "Photo removed.";
}

function closeEmployeeInfo() {
    if (!dom.employeeInfoOverlay) return;
    dom.employeeInfoOverlay.hidden = true;
    activeEmployeeProfileId = null;
    if (dom.employeeInfoForm) dom.employeeInfoForm.reset();
    if (dom.employeeInfoMessage) dom.employeeInfoMessage.textContent = "";
}

function moveEmployee(employeeId, direction) {
    const employee = getEmployee(employeeId);
    const area = getCurrentManagerArea();
    if (!employee || getEmployeeArea(employee) !== area || ![-1, 1].includes(direction)) return;

    normalizeEmployeeOrders(state.employees, area);
    const group = getGroupedEmployees(getManagerEmployees(), area)
        .find((item) => item.employees.some((groupEmployee) => groupEmployee.id === employeeId));
    if (!group) return;

    const currentIndex = group.employees.findIndex((groupEmployee) => groupEmployee.id === employeeId);
    const target = group.employees[currentIndex + direction];
    if (!target) return;

    const currentOrder = employee.order;
    employee.order = target.order;
    target.order = currentOrder;
    normalizeEmployeeOrders(state.employees, area);
    saveState();
    renderEmployees();
}

function removeEmployee(employeeId) {
    const employee = getEmployee(employeeId);
    const area = employee ? getEmployeeArea(employee) : getCurrentManagerArea();
    if (activeEmployeeProfileId === employeeId) closeEmployeeInfo();
    state.employees = state.employees.filter((employee) => employee.id !== employeeId);
    delete state.availability[employeeId];
    Object.keys(state.shifts).forEach((dateKey) => {
        state.shifts[dateKey] = state.shifts[dateKey].filter((shift) => shift.employeeId !== employeeId);
        if (!state.shifts[dateKey].length) delete state.shifts[dateKey];
    });
    Object.keys(state.publishedShifts).forEach((dateKey) => {
        state.publishedShifts[dateKey] = state.publishedShifts[dateKey].filter((shift) => shift.employeeId !== employeeId);
        if (!state.publishedShifts[dateKey].length) delete state.publishedShifts[dateKey];
    });
    state.swapRequests = state.swapRequests.filter((request) => request.employeeId !== employeeId);
    Object.keys(state.confirmations).forEach((shiftId) => {
        delete state.confirmations[shiftId][employeeId];
        if (!Object.keys(state.confirmations[shiftId]).length) delete state.confirmations[shiftId];
    });
    if (currentUser && currentUser.type === "employee" && currentUser.employeeId === employeeId) {
        currentUser = null;
        saveSession();
    }
    normalizeEmployeeOrders(state.employees, area);
    saveState();
    render();
}

function handleWeekBuilderClick(event) {
    const profileButton = event.target.closest("[data-action='view-employee']");
    if (profileButton) {
        openEmployeeInfo(profileButton.dataset.id);
        return;
    }

    const button = event.target.closest("[data-date]");
    if (!button) return;
    setSelectedDate(parseDate(button.dataset.date));
}

function handleCoverageInput(event) {
    const input = event.target.closest("[data-coverage-target]");
    if (!input) return;

    const manager = getCurrentManagerConfig();
    const targetKey = input.dataset.coverageTarget;
    const value = Math.max(0, Number.parseInt(input.value, 10) || 0);
    if (!state.coverageTargets[selectedDate]) state.coverageTargets[selectedDate] = {};
    if (!state.coverageTargets[selectedDate][manager.area]) state.coverageTargets[selectedDate][manager.area] = {};
    state.coverageTargets[selectedDate][manager.area][targetKey] = value;
    saveState();
    renderCoveragePanel();
    renderScheduleWarnings();
}

function publishCurrentMonth() {
    const manager = getCurrentManagerConfig();
    const monthKeys = new Set([
        ...Object.keys(state.shifts),
        ...Object.keys(state.publishedShifts)
    ].filter((dateKey) => isSameMonth(parseDate(dateKey), currentMonth)));

    monthKeys.forEach((dateKey) => {
        const existingPublished = state.publishedShifts[dateKey] || [];
        const outsideArea = existingPublished.filter((shift) => {
            const employee = getEmployee(shift.employeeId);
            return !employee || getEmployeeArea(employee) !== manager.area;
        });
        const areaDraft = getDateShiftsForArea(dateKey, manager.area, state.shifts)
            .map((shift) => cloneShift(shift, { keepId: true }));
        const merged = [...outsideArea, ...areaDraft];
        if (merged.length) {
            state.publishedShifts[dateKey] = merged;
        } else {
            delete state.publishedShifts[dateKey];
        }
    });

    state.publishedAt[getPublishKey(manager.area, currentMonth)] = new Date().toISOString();
    pruneShiftTracking();
    saveState();
    render();
}

function copySelectedDay() {
    const manager = getCurrentManagerConfig();
    copiedDayShifts = {
        sourceDate: selectedDate,
        shifts: getDateShiftsForArea(selectedDate, manager.area, state.shifts).map((shift) => cloneShift(shift))
    };
    if (dom.shiftFormMessage) dom.shiftFormMessage.textContent = `${copiedDayShifts.shifts.length} ${copiedDayShifts.shifts.length === 1 ? "shift" : "shifts"} copied from ${longDate(selectedDate)}.`;
    renderScheduleWorkflow();
}

function pasteCopiedDay() {
    if (!copiedDayShifts) return;
    const additions = copiedDayShifts.shifts
        .filter((shift) => getEmployee(shift.employeeId) && !hasEmployeeShiftOnDate(shift.employeeId, selectedDate))
        .map((shift) => createShift(shift));

    if (!additions.length) {
        if (dom.shiftFormMessage) dom.shiftFormMessage.textContent = "No shifts pasted because everyone copied is already scheduled that day.";
        renderShiftEmployeeOptions();
        return;
    }

    state.shifts[selectedDate] = [...(state.shifts[selectedDate] || []), ...additions];
    saveState();
    if (dom.shiftFormMessage) dom.shiftFormMessage.textContent = `Pasted ${additions.length} ${additions.length === 1 ? "shift" : "shifts"} into ${longDate(selectedDate)}.`;
    renderManagerSchedule();
}

function copySelectedWeek() {
    const manager = getCurrentManagerConfig();
    const week = getWeekDates(parseDate(selectedDate));
    copiedWeekShifts = {
        sourceStart: formatDate(week[0]),
        days: week.map((date) => ({
            offset: date.getDay(),
            shifts: getDateShiftsForArea(formatDate(date), manager.area, state.shifts).map((shift) => cloneShift(shift))
        }))
    };
    const copiedCount = copiedWeekShifts.days.reduce((sum, day) => sum + day.shifts.length, 0);
    if (dom.shiftFormMessage) dom.shiftFormMessage.textContent = `${copiedCount} ${copiedCount === 1 ? "shift" : "shifts"} copied from the week of ${formatPrintDate(week[0])}.`;
    renderScheduleWorkflow();
}

function pasteCopiedWeek() {
    if (!copiedWeekShifts) return;
    const targetWeek = getWeekDates(parseDate(selectedDate));
    let pasted = 0;

    copiedWeekShifts.days.forEach((day) => {
        const targetDateKey = formatDate(targetWeek[day.offset]);
        const additions = day.shifts
            .filter((shift) => getEmployee(shift.employeeId) && !hasEmployeeShiftOnDate(shift.employeeId, targetDateKey))
            .map((shift) => createShift(shift));
        if (!additions.length) return;
        state.shifts[targetDateKey] = [...(state.shifts[targetDateKey] || []), ...additions];
        pasted += additions.length;
    });

    saveState();
    if (dom.shiftFormMessage) {
        dom.shiftFormMessage.textContent = pasted
            ? `Pasted ${pasted} ${pasted === 1 ? "shift" : "shifts"} into the selected week.`
            : "No shifts pasted because the copied employees were already scheduled.";
    }
    renderManagerSchedule();
}

function exportPayrollCsv() {
    const manager = getCurrentManagerConfig();
    const employees = getManagerEmployees();
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const rows = [[
        "Type",
        "Employee",
        "Area",
        "Category",
        "Date",
        "Start",
        "End",
        "Role",
        "Hours",
        "Public note"
    ]];

    Object.entries(state.shifts)
        .filter(([dateKey]) => isSameMonth(parseDate(dateKey), currentMonth))
        .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
        .forEach(([dateKey, shifts]) => {
            sortShiftsByStart(shifts.filter((shift) => employeeIds.has(shift.employeeId))).forEach((shift) => {
                const employee = getEmployee(shift.employeeId);
                rows.push([
                    "Shift",
                    employee ? employee.name : "Removed employee",
                    manager.label,
                    employee ? employeeCategoryLabel(employee) : "",
                    dateKey,
                    shift.start,
                    shift.end,
                    shift.role || (employee ? employee.role : ""),
                    formatDecimalHours(getShiftMinutes(shift)),
                    shift.note || ""
                ]);
            });
        });

    getMonthlyHoursByEmployee(currentMonth, employees).forEach(({ employee, minutes, shifts }) => {
        rows.push([
            "Total",
            employee.name,
            manager.label,
            employeeCategoryLabel(employee),
            "",
            "",
            "",
            `${shifts} ${shifts === 1 ? "shift" : "shifts"}`,
            formatDecimalHours(minutes),
            ""
        ]);
    });

    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    downloadTextFile(csv, `oak34-${manager.shortLabel.toLowerCase()}-payroll-${formatMonthKey(currentMonth)}.csv`, "text/csv");
}

function applyShiftTemplate(templateId, target) {
    const template = getShiftTemplate(templateId);
    if (!template) return;

    if (target === "builder") {
        dom.builderShiftRole.value = template.role;
        dom.builderShiftStart.value = template.start;
        dom.builderShiftEnd.value = template.end;
        dom.builderShiftNote.value = template.note;
        dom.builderShiftPrivateNote.value = template.privateNote || "";
        return;
    }

    if (target === "popover") {
        dom.popoverShiftRole.value = template.role;
        dom.popoverShiftStart.value = template.start;
        dom.popoverShiftEnd.value = template.end;
        dom.popoverShiftNote.value = template.note;
        dom.popoverShiftPrivateNote.value = template.privateNote || "";
        return;
    }

    if (!dom.shiftRole) return;
    dom.shiftRole.value = template.role;
    dom.shiftStart.value = template.start;
    dom.shiftEnd.value = template.end;
    dom.shiftNote.value = template.note;
    dom.shiftPrivateNote.value = template.privateNote || "";
}

function saveCurrentShiftTemplate() {
    const manager = getCurrentManagerConfig();
    if (!dom.shiftRole) return;
    const fallbackName = dom.shiftRole.value.trim() || `${dom.shiftStart.value}-${dom.shiftEnd.value}`;
    const name = window.prompt("Template name", fallbackName);
    if (!name) return;

    const template = {
        id: `template-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: name.trim(),
        area: manager.area,
        role: dom.shiftRole.value.trim(),
        start: dom.shiftStart.value,
        end: dom.shiftEnd.value,
        note: dom.shiftNote.value.trim(),
        privateNote: dom.shiftPrivateNote.value.trim()
    };
    state.shiftTemplates.push(template);
    saveState();
    renderShiftTemplateOptions();
    dom.shiftTemplate.value = template.id;
    dom.shiftFormMessage.textContent = "Template saved.";
}

function confirmShift(shiftId, employeeId) {
    if (!state.confirmations[shiftId]) state.confirmations[shiftId] = {};
    state.confirmations[shiftId][employeeId] = true;
    saveState();
    renderEmployeeAvailability();
}

function requestShiftSwap(shiftId, employeeId) {
    const existing = getEmployeeSwapRequest(shiftId, employeeId);
    if (existing) return;
    const request = {
        id: `swap-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        shiftId,
        employeeId,
        dateKey: selectedDate,
        message: "",
        status: "pending",
        createdAt: new Date().toISOString()
    };
    state.swapRequests.push(request);
    saveState();
    renderEmployeeAvailability();
}

function updateSwapRequestStatus(requestId, status) {
    const request = state.swapRequests.find((item) => item.id === requestId);
    if (!request || !["approved", "denied"].includes(status)) return;
    request.status = status;
    saveState();
    renderManagerSchedule();
}

function getScheduleWarnings(dateKey) {
    const manager = getCurrentManagerConfig();
    const employees = getManagerEmployees();
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
    const shifts = getDateShiftsForArea(dateKey, manager.area, state.shifts);
    const warnings = [];
    const duplicateNames = [];
    const unavailableNames = [];
    const noAvailabilityNames = [];
    const invalidTimeNames = [];
    const quickTurnaroundNames = [];
    const countsByEmployee = shifts.reduce((map, shift) => {
        map.set(shift.employeeId, (map.get(shift.employeeId) || 0) + 1);
        return map;
    }, new Map());

    countsByEmployee.forEach((count, employeeId) => {
        if (count > 1) {
            const employee = employeeMap.get(employeeId);
            duplicateNames.push(employee ? employee.name : "Removed employee");
        }
    });

    shifts.forEach((shift) => {
        const employee = employeeMap.get(shift.employeeId);
        const name = employee ? employee.name : "Removed employee";
        const availability = getAvailability(shift.employeeId, dateKey);
        if (!employee) warnings.push({ title: "Removed employee on schedule", detail: "A shift is assigned to someone no longer in this team.", severity: "danger", icon: "user-x" });
        if (availability && availability.status === "unavailable") unavailableNames.push(name);
        if (!availability) noAvailabilityNames.push(name);
        if (!getShiftMinutes(shift)) invalidTimeNames.push(name);
        if (hasShortTurnaround(shift, dateKey)) quickTurnaroundNames.push(name);
    });

    if (!arePublishedShiftsCurrent(manager.area, currentMonth)) {
        warnings.push({
            title: "Unpublished changes",
            detail: "Employees will not see this draft until you publish the month.",
            severity: "notice",
            icon: "send"
        });
    }

    if (duplicateNames.length) warnings.push({
        title: "Double shift on one day",
        detail: `${formatNameList(duplicateNames)} ${duplicateNames.length === 1 ? "has" : "have"} more than one shift today.`,
        severity: "danger",
        icon: "copy-x"
    });
    if (unavailableNames.length) warnings.push({
        title: "Scheduled while unavailable",
        detail: formatNameList(unavailableNames),
        severity: "danger",
        icon: "calendar-x"
    });
    if (noAvailabilityNames.length) warnings.push({
        title: "No availability entered",
        detail: formatNameList(noAvailabilityNames),
        severity: "notice",
        icon: "calendar-question"
    });
    if (invalidTimeNames.length) warnings.push({
        title: "Check shift times",
        detail: formatNameList(invalidTimeNames),
        severity: "danger",
        icon: "clock-alert"
    });
    if (quickTurnaroundNames.length) warnings.push({
        title: "Short turnaround",
        detail: `${formatNameList(quickTurnaroundNames)} ${quickTurnaroundNames.length === 1 ? "has" : "have"} less than 10 hours between shifts.`,
        severity: "notice",
        icon: "timer-reset"
    });

    const pendingSwapCount = shifts.reduce((count, shift) => (
        count + getSwapRequestsForShift(shift.id).filter((request) => request.status === "pending").length
    ), 0);
    if (pendingSwapCount) warnings.push({
        title: "Swap requests waiting",
        detail: `${pendingSwapCount} pending ${pendingSwapCount === 1 ? "request" : "requests"} for this day.`,
        severity: "notice",
        icon: "repeat-2"
    });

    getCoverageWarnings(dateKey, manager.area).forEach((warning) => warnings.push(warning));
    return warnings;
}

function changePeriod(delta) {
    if (isManagerScheduleView()) {
        changeWeek(delta);
        return;
    }
    changeMonth(delta);
}

function changeWeek(delta) {
    closeShiftPopover();
    const date = parseDate(selectedDate);
    date.setDate(date.getDate() + (delta * 7));
    currentMonth = startOfMonth(date);
    selectedDate = formatDate(date);
    availabilityBuilderSelectedIds.clear();
    renderMonthLabel();
    renderActiveView();
}

function changeMonth(delta) {
    closeShiftPopover();
    currentMonth = addMonths(currentMonth, delta);
    selectedDate = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    availabilityBuilderSelectedIds.clear();
    renderMonthLabel();
    renderActiveView();
}

function jumpToToday() {
    setSelectedDate(new Date());
}

function changeBuilderDay(delta) {
    const date = parseDate(selectedDate);
    date.setDate(date.getDate() + delta);
    setSelectedDate(date);
}

function jumpBuilderToToday() {
    setSelectedDate(new Date());
}

function setSelectedDate(date) {
    closeShiftPopover();
    currentMonth = startOfMonth(date);
    selectedDate = formatDate(date);
    availabilityBuilderSelectedIds.clear();
    renderMonthLabel();
    renderActiveView();
}

function isManagerScheduleView() {
    return Boolean(currentUser && currentUser.type === "manager" && activeView === "schedule");
}

function getScheduleGridDates() {
    return getWeekDates(parseDate(selectedDate));
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

function hasEmployeeShiftOnDate(employeeId, dateKey, shiftsByDate = state.shifts) {
    return (shiftsByDate[dateKey] || []).some((shift) => shift.employeeId === employeeId);
}

function createShift({ employeeId, start, end, role, note, privateNote }) {
    return {
        id: `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        employeeId,
        start,
        end,
        role,
        note,
        privateNote: privateNote || ""
    };
}

function cloneShift(shift, options = {}) {
    const normalized = normalizeShift(shift);
    return {
        ...normalized,
        id: options.keepId ? normalized.id : `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`
    };
}

function getDateShiftsForArea(dateKey, area, shiftsByDate = state.shifts) {
    return sortShiftsByStart((shiftsByDate[dateKey] || []).filter((shift) => {
        const employee = getEmployee(shift.employeeId);
        return employee && getEmployeeArea(employee) === area;
    }));
}

function getAreaMonthShifts(shiftsByDate, area, monthDate) {
    return Object.entries(shiftsByDate || {}).flatMap(([dateKey, shifts]) => {
        if (!isSameMonth(parseDate(dateKey), monthDate)) return [];
        return getDateShiftsForArea(dateKey, area, { [dateKey]: shifts })
            .map((shift) => ({ ...shift, dateKey }));
    });
}

function getPublishKey(area, monthDate) {
    return `${area}-${formatMonthKey(monthDate)}`;
}

function arePublishedShiftsCurrent(area, monthDate) {
    return getShiftSignature(getAreaMonthShifts(state.shifts, area, monthDate))
        === getShiftSignature(getAreaMonthShifts(state.publishedShifts, area, monthDate));
}

function getShiftSignature(shifts) {
    return shifts.map((shift) => [
        shift.dateKey,
        shift.employeeId,
        shift.start,
        shift.end,
        shift.role || "",
        shift.note || "",
        shift.privateNote || ""
    ].join("|")).sort().join("\n");
}

function pruneShiftTracking() {
    const publishedShiftIds = new Set(Object.values(state.publishedShifts).flatMap((shifts) => shifts.map((shift) => shift.id)));
    Object.keys(state.confirmations).forEach((shiftId) => {
        if (!publishedShiftIds.has(shiftId)) delete state.confirmations[shiftId];
    });
    state.swapRequests = state.swapRequests.filter((request) => publishedShiftIds.has(request.shiftId));
}

function getWeekDates(date) {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(date.getDate() + days);
    return next;
}

function getWeekMinutesForEmployee(employeeId, week, shiftsByDate = state.shifts) {
    return week.reduce((sum, date) => {
        const dateKey = formatDate(date);
        return sum + getEmployeeShiftsForDate(employeeId, dateKey, shiftsByDate)
            .reduce((daySum, shift) => daySum + getShiftMinutes(shift), 0);
    }, 0);
}

function getCoverageTargetGroups(area) {
    return area === "boh"
        ? kitchenCategories
        : [{ id: "foh", label: "Front of House" }];
}

function getCoverageTargets(dateKey, area) {
    return state.coverageTargets[dateKey] && state.coverageTargets[dateKey][area]
        ? state.coverageTargets[dateKey][area]
        : {};
}

function getCoverageCounts(dateKey, area, shiftsByDate = state.shifts) {
    const counts = getCoverageTargetGroups(area).reduce((nextCounts, group) => {
        nextCounts[group.id] = 0;
        return nextCounts;
    }, {});

    getDateShiftsForArea(dateKey, area, shiftsByDate).forEach((shift) => {
        const employee = getEmployee(shift.employeeId);
        const key = area === "boh" ? getEmployeeCategory(employee) : "foh";
        counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
}

function getCoverageWarnings(dateKey, area) {
    const targets = getCoverageTargets(dateKey, area);
    const counts = getCoverageCounts(dateKey, area);
    return getCoverageTargetGroups(area).flatMap((group) => {
        const target = targets[group.id] || 0;
        const count = counts[group.id] || 0;
        if (!target || count === target) return [];
        if (count < target) {
            return [{
                title: `${group.label} coverage low`,
                detail: `${count}/${target} scheduled for ${longDate(dateKey)}.`,
                severity: "danger",
                icon: "users"
            }];
        }
        return [{
            title: `${group.label} over target`,
            detail: `${count}/${target} scheduled for ${longDate(dateKey)}.`,
            severity: "notice",
            icon: "user-plus"
        }];
    });
}

function formatCoverageTargetSummary(dateKey, area) {
    const targets = getCoverageTargets(dateKey, area);
    const counts = getCoverageCounts(dateKey, area);
    const parts = getCoverageTargetGroups(area)
        .filter((group) => targets[group.id] || counts[group.id])
        .map((group) => `${group.label}: ${counts[group.id] || 0}/${targets[group.id] || 0}`);
    return parts.length ? parts.join(" | ") : "-";
}

function getShiftTemplatesForArea(area) {
    return state.shiftTemplates.filter((template) => template.area === area || template.area === "all");
}

function getShiftTemplate(templateId) {
    return state.shiftTemplates.find((template) => template.id === templateId);
}

function isShiftConfirmed(shiftId, employeeId) {
    return Boolean(state.confirmations[shiftId] && state.confirmations[shiftId][employeeId]);
}

function getSwapRequestsForShift(shiftId) {
    return state.swapRequests.filter((request) => request.shiftId === shiftId);
}

function getEmployeeSwapRequest(shiftId, employeeId) {
    return state.swapRequests.find((request) => request.shiftId === shiftId && request.employeeId === employeeId);
}

function renderEmployeeShiftMeta(shift, employee) {
    const details = [isShiftConfirmed(shift.id, employee.id) ? "Confirmed" : "Needs confirmation"];
    const swapRequest = getEmployeeSwapRequest(shift.id, employee.id);
    if (swapRequest) details.push(`Swap ${swapRequest.status}`);
    return `<small>${escapeHtml(details.join(" | "))}</small>`;
}

function renderManagerShiftMeta(shift, employee) {
    const details = [];
    if (shift.note) details.push(`Note: ${shift.note}`);
    if (shift.privateNote) details.push(`Private: ${shift.privateNote}`);
    if (employee) details.push(isShiftConfirmed(shift.id, employee.id) ? "Confirmed" : "Not confirmed");
    const swapRequests = getSwapRequestsForShift(shift.id);
    if (swapRequests.length) {
        const pending = swapRequests.filter((request) => request.status === "pending").length;
        const resolved = swapRequests.length - pending;
        details.push(`${pending} pending swap${pending === 1 ? "" : "s"}${resolved ? `, ${resolved} resolved` : ""}`);
    }
    return details.length ? `<small>${escapeHtml(details.join(" | "))}</small>` : "";
}

function hasShortTurnaround(shift, dateKey) {
    const current = getShiftDateTimes(dateKey, shift);
    if (!current) return false;
    const employeeShifts = Object.entries(state.shifts).flatMap(([entryDateKey, shifts]) => (
        shifts
            .filter((entryShift) => entryShift.employeeId === shift.employeeId)
            .map((entryShift) => ({ shift: entryShift, dateKey: entryDateKey, range: getShiftDateTimes(entryDateKey, entryShift) }))
            .filter((entry) => entry.range)
    )).sort((first, second) => first.range.start - second.range.start);

    const index = employeeShifts.findIndex((entry) => entry.shift.id === shift.id && entry.dateKey === dateKey);
    if (index === -1) return false;

    const minGap = 10 * 60 * 1000 * 60;
    const previous = employeeShifts[index - 1];
    const next = employeeShifts[index + 1];
    return Boolean(
        (previous && current.start - previous.range.end < minGap)
        || (next && next.range.start - current.end < minGap)
    );
}

function getShiftDateTimes(dateKey, shift) {
    const startMinutes = timeToMinutes(shift.start);
    const endMinutes = timeToMinutes(shift.end);
    if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return null;

    const start = parseDate(dateKey);
    start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    const end = parseDate(dateKey);
    end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
    return { start, end };
}

function formatNameList(names) {
    const uniqueNames = [...new Set(names)].filter(Boolean);
    if (uniqueNames.length <= 4) return uniqueNames.join(", ");
    return `${uniqueNames.slice(0, 4).join(", ")} and ${uniqueNames.length - 4} more`;
}

function formatDecimalHours(minutes) {
    return (minutes / 60).toFixed(2);
}

function escapeCsv(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadTextFile(contents, filename, type) {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function getAvailabilitySummary(dateKey, employees = state.employees) {
    return employees.reduce((summary, employee) => {
        const availability = getAvailability(employee.id, dateKey);
        if (availability) summary[availability.status] += 1;
        return summary;
    }, { available: 0, maybe: 0, unavailable: 0 });
}

function getMonthlyHoursByEmployee(monthDate, employees = state.employees, shiftsByDate = state.shifts) {
    return employees.map((employee) => ({
        employee,
        minutes: getEmployeeMonthlyMinutes(employee.id, monthDate, shiftsByDate),
        shifts: getEmployeeMonthlyShiftCount(employee.id, monthDate, shiftsByDate)
    }));
}

function getEmployeeMonthlyMinutes(employeeId, monthDate, shiftsByDate = state.shifts) {
    return Object.entries(shiftsByDate).reduce((total, [dateKey, shifts]) => {
        if (!isSameMonth(parseDate(dateKey), monthDate)) return total;
        return total + shifts
            .filter((shift) => shift.employeeId === employeeId)
            .reduce((sum, shift) => sum + getShiftMinutes(shift), 0);
    }, 0);
}

function getEmployeeMonthlyShiftCount(employeeId, monthDate, shiftsByDate = state.shifts) {
    return Object.entries(shiftsByDate).reduce((count, [dateKey, shifts]) => {
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

function getShiftStatsForDates(dateKeys, employees, shiftsByDate = state.shifts) {
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const shifts = dateKeys.flatMap((dateKey) => (shiftsByDate[dateKey] || []).filter((shift) => employeeIds.has(shift.employeeId)));
    return {
        shifts: shifts.length,
        minutes: shifts.reduce((sum, shift) => sum + getShiftMinutes(shift), 0)
    };
}

function getEmployeeShiftsForDate(employeeId, dateKey, shiftsByDate = state.shifts) {
    return sortShiftsByStart((shiftsByDate[dateKey] || []).filter((shift) => shift.employeeId === employeeId));
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

function formatMonthKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "recently";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
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

function weekTitle(dates) {
    if (!dates.length) return monthTitle(currentMonth);
    const first = dates[0];
    const last = dates[dates.length - 1];
    const sameYear = first.getFullYear() === last.getFullYear();
    const firstLabel = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: sameYear ? undefined : "numeric"
    }).format(first);
    const lastLabel = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(last);
    return `${firstLabel} - ${lastLabel}`;
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

function renderEmployeeAvatar(employee, className = "employee-photo") {
    const name = employee && employee.name ? employee.name : "Employee";
    const photo = normalizeEmployeePhoto(employee && employee.photo);
    if (photo) {
        return `
            <span class="${className} has-photo">
                <img src="${escapeHtml(photo)}" alt="${escapeHtml(name)} photo" loading="lazy">
            </span>
        `;
    }

    return `<span class="${className} fallback" style="background:${safeAccentColor(employee && employee.color)}">${escapeHtml(getInitials(name) || "?")}</span>`;
}

function getEmployeeContactSummary(employee) {
    const labels = [];
    if (employee.photo) labels.push("Photo");
    if (employee.email) labels.push("Email");
    if (employee.phone) labels.push("Phone");
    if (employee.notes) labels.push("Notes");
    return labels.length ? `${labels.join(" + ")} saved` : "Open profile to add contact info";
}

async function readEmployeePhotoInput(input) {
    const file = input && input.files ? input.files[0] : null;
    if (!file) return "";
    if (!file.type || !file.type.startsWith("image/")) {
        throw new Error("Choose an image file for the photo.");
    }
    if (file.size > 8 * 1024 * 1024) {
        throw new Error("Choose a photo smaller than 8 MB.");
    }
    return resizeEmployeePhoto(file);
}

function resizeEmployeePhoto(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const imageUrl = URL.createObjectURL(file);
        image.onload = () => {
            try {
                const naturalWidth = image.naturalWidth || image.width;
                const naturalHeight = image.naturalHeight || image.height;
                const sourceSize = Math.min(naturalWidth, naturalHeight);
                const sourceX = Math.max(0, (naturalWidth - sourceSize) / 2);
                const sourceY = Math.max(0, (naturalHeight - sourceSize) / 2);
                const canvas = document.createElement("canvas");
                const size = 320;
                canvas.width = size;
                canvas.height = size;
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Photo could not be prepared.");
                context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
                URL.revokeObjectURL(imageUrl);
                resolve(canvas.toDataURL("image/jpeg", 0.84));
            } catch (error) {
                URL.revokeObjectURL(imageUrl);
                reject(new Error("Photo could not be prepared."));
            }
        };
        image.onerror = () => {
            URL.revokeObjectURL(imageUrl);
            reject(new Error("Photo could not be opened."));
        };
        image.src = imageUrl;
    });
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
