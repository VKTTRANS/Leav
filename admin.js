let historyCurrentPage = 1; 
let currentSearchStartDate, currentSearchEndDate; 
let currentHistoryList = []; 
let summaryCurrentPage = 1, fullSummaryData = [], filteredSummaryData = []; 
let allUsersData = []; 
let filteredUsersData = []; 
let usersCurrentPage = 1; 
let currentManageYear = null; 

function handleLogout() { 
    localStorage.removeItem('sessionToken'); 
    window.location.href = "login.html"; 
}

async function initAdminApp() {
    if (!localStorage.getItem('sessionToken')) { 
        document.body.innerHTML = `<div style="text-align: center; padding: 40px; color: white;"><h2>เข้าถึงไม่ได้</h2><a href="login.html" style="background-color: #10b981; color: white; padding: 10px 20px; border-radius:8px; text-decoration:none;">ไปที่หน้าล็อกอิน</a></div>`; 
        return; 
    }
    
    document.querySelector('.container').style.display = 'block';
    
    // Tab Navigation
    document.querySelectorAll(".tab-button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
    
    // Pending Requests Tab
    document.getElementById("select-all")?.addEventListener("change", toggleSelectAll); 
    document.getElementById("approve-btn")?.addEventListener('click', () => processSelected('approve')); 
    document.getElementById("reject-btn")?.addEventListener('click', () => processSelected('reject'));
    
    // Summary Reports Tab
    populateReportYears(); 
    document.getElementById("report-year-select")?.addEventListener("change", loadSummaryReport); 
    document.getElementById("summary-search-input")?.addEventListener("keyup", filterSummaryTable); 
    document.getElementById("summary-page-size")?.addEventListener("change", () => renderSummaryPage(1)); 
    document.getElementById("summary-prev-btn")?.addEventListener("click", () => renderSummaryPage(summaryCurrentPage - 1)); 
    document.getElementById("summary-next-btn")?.addEventListener("click", () => renderSummaryPage(summaryCurrentPage + 1));
    
    // History Filters
    document.querySelectorAll(".quick-filter-controls button").forEach(b => {
        b.addEventListener("click", function() { 
            const p = this.dataset.period; 
            if(p === 'custom') { toggleCustomRange(this) } else { quickSearch(p, this) } 
        });
    }); 
    document.getElementById("custom-search-btn")?.addEventListener('click', searchByCustomRange); 
    document.getElementById("results-per-page")?.addEventListener("change", () => loadHistoryPage(1)); 
    document.getElementById("prev-btn")?.addEventListener("click", () => loadHistoryPage(historyCurrentPage - 1)); 
    document.getElementById("next-btn")?.addEventListener("click", () => loadHistoryPage(historyCurrentPage + 1));
    
    // Users Tab
    document.getElementById("add-user-btn")?.addEventListener('click', () => openUserModal()); 
    document.getElementById("sync-btn")?.addEventListener('click', handleSyncHR); 
    document.getElementById("user-search-input")?.addEventListener("keyup", filterUsersTable); 
    document.getElementById("users-page-size")?.addEventListener("change", () => renderUsersTable(1)); 
    document.getElementById("users-prev-btn")?.addEventListener("click", () => renderUsersTable(usersCurrentPage - 1)); 
    document.getElementById("users-next-btn")?.addEventListener("click", () => renderUsersTable(usersCurrentPage + 1));
    
    // Settings Tab
    document.getElementById('export-excel-btn')?.addEventListener('click', handleExportExcel); 
    document.getElementById("reset-btn")?.addEventListener('click', confirmReset); 
    document.getElementById("btn-save-holiday")?.addEventListener('click', saveHolidayLogic); 
    document.getElementById("btn-cancel-edit")?.addEventListener('click', resetHolidayForm);
    
    // User Modal
    document.querySelector("#user-modal .close-btn")?.addEventListener('click', closeUserModal); 
    document.getElementById("modal-cancel-btn")?.addEventListener('click', closeUserModal); 
    document.getElementById("modal-save-btn")?.addEventListener('click', saveUser);
    
    populateYearSelect(); 
    showTab("pending");
}

document.addEventListener('DOMContentLoaded', initAdminApp);

function showTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(el => { el.style.display = "none"; el.classList.remove("active"); });
    document.querySelectorAll(".tab-button").forEach(el => el.classList.remove("active"));
    
    const tabToShow = document.getElementById(tabName); 
    const buttonToActivate = document.querySelector(`.tab-button[data-tab='${tabName}']`);
    
    if(tabToShow) { 
        tabToShow.style.display = "block"; 
        requestAnimationFrame(() => { tabToShow.classList.add("active"); }); 
    }
    if(buttonToActivate) buttonToActivate.classList.add("active");
    
    if (tabName === "pending" && tabToShow.dataset.loaded !== 'true') loadPendingRequests(); 
    if (tabName === "users" && !tabToShow.dataset.loaded) loadUsers(); 
    if (tabName === "reports" && !tabToShow.dataset.loaded) { loadSummaryReport(); quickSearch('week', document.querySelector(".quick-filter-controls button[data-period='week']")); } 
    if (tabName === "settings") loadHolidayYears();
    
    if(tabToShow) tabToShow.dataset.loaded = 'true';
}

function handleSyncHR() {
    Swal.fire({ 
        title: 'ยืนยันการดึงข้อมูล?', 
        html: `<div style="text-align:left; font-size:0.95em;">ระบบจะเชื่อมต่อ <b>HR Database</b> เพื่อ:<ul style="margin-top:5px; margin-bottom:5px; padding-left:20px;"><li>ดึงพนักงาน Active ที่ยังไม่มีในระบบ</li><li>คำนวณวันลาตามอายุงาน</li><li>อัปเดตสถานะ Resigned</li></ul></div>`, 
        icon: 'question', 
        showCancelButton: true, 
        confirmButtonText: 'เริ่มดึงข้อมูล', 
        cancelButtonText: 'ยกเลิก', 
        confirmButtonColor: '#3b82f6', 
        cancelButtonColor: '#475569', 
        reverseButtons: true 
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังประมวลผล...', text: 'กรุณารอสักครู่', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try { 
                const res = await apiCall('syncUsersFromHR'); 
                if (res.success) { Swal.fire('สำเร็จ!', res.message, 'success'); loadUsers(); } 
                else { Swal.fire('เกิดข้อผิดพลาด', res.message, 'error'); } 
            } catch(err) { 
                Swal.fire('Error', err.message, 'error'); 
            }
        }
    });
}

function populateReportYears() { 
    const select = document.getElementById("report-year-select"); 
    const currentYear = new Date().getFullYear(); 
    select.innerHTML = ""; 
    for (let y = currentYear + 1; y >= 2024; y--) { 
        const option = document.createElement("option"); 
        option.value = y; 
        option.text = "ปี " + y; 
        if (y === currentYear) option.selected = true; 
        select.appendChild(option); 
    } 
}

async function loadHolidayYears() {
    const grid = document.getElementById('year-grid'); 
    const addBtn = grid.lastElementChild; 
    grid.innerHTML = '';
    try { 
        const res = await apiCall('getHolidayYears'); 
        if (res.success) { 
            res.data.forEach(year => { 
                const card = document.createElement('div'); 
                card.className = 'year-card'; 
                card.innerHTML = `<h3>${year}</h3><p style="color:#94a3b8; font-size:0.8em; margin:5px 0 0;">จัดการวันหยุด</p>`; 
                card.onclick = () => openHolidayModal(year); 
                grid.appendChild(card); 
            }); 
        } 
        grid.appendChild(addBtn); 
    } catch(e) {}
}

function openHolidayModal(year) { 
    currentManageYear = year; 
    document.getElementById('holiday-modal-title').innerText = `จัดการวันหยุดปี ${year}`; 
    document.getElementById('holiday-manager-modal').style.display = 'block'; 
    resetHolidayForm(); 
    loadHolidaysForModal(year); 
}

function closeHolidayModal() { 
    document.getElementById('holiday-manager-modal').style.display = 'none'; 
    loadHolidayYears(); 
}

async function loadHolidaysForModal(year) {
    const tbody = document.getElementById('holiday-modal-tbody'); 
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#aaa;">กำลังโหลด...</td></tr>';
    try { 
        const res = await apiCall('getHolidaysByYear', year); 
        tbody.innerHTML = ''; 
        if (res.success && res.data.length > 0) { 
            res.data.forEach(h => { 
                const tr = document.createElement('tr'); 
                const dateStr = new Date(h.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }); 
                tr.innerHTML = `<td>${dateStr}</td><td>${h.name}</td><td style="text-align:center;"><div style="display:flex; gap:5px; justify-content:center;"><button class="edit-btn" style="padding:4px 10px; font-size:12px;" onclick='prepareEditHoliday(${JSON.stringify(h)})'>แก้ไข</button> <button class="delete-btn" style="padding:4px 10px; font-size:12px;" onclick="deleteHolidayFunc('${h.date}', '${h.name}')">ลบ</button></div></td>`; 
                tbody.appendChild(tr); 
            }); 
        } else { 
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#757575; padding:20px;">ยังไม่มีข้อมูล</td></tr>'; 
        } 
    } catch(e) {}
}

function prepareEditHoliday(holiday) { 
    document.getElementById('h-name').value = holiday.name; 
    document.getElementById('h-date').value = holiday.date; 
    document.getElementById('edit-original-name').value = holiday.name; 
    document.getElementById('edit-original-date').value = holiday.date; 
    const btn = document.getElementById('btn-save-holiday'); 
    btn.innerText = 'บันทึก'; 
    btn.classList.remove('approve-btn'); 
    btn.classList.add('edit-btn'); 
    document.getElementById('btn-cancel-edit').style.display = 'inline-block'; 
}

function resetHolidayForm() { 
    document.getElementById('h-name').value = ''; 
    document.getElementById('h-date').value = ''; 
    document.getElementById('edit-original-name').value = ''; 
    document.getElementById('edit-original-date').value = ''; 
    const btn = document.getElementById('btn-save-holiday'); 
    btn.innerText = 'เพิ่ม'; 
    btn.classList.add('approve-btn'); 
    btn.classList.remove('edit-btn'); 
    document.getElementById('btn-cancel-edit').style.display = 'none'; 
}

async function saveHolidayLogic() {
    const name = document.getElementById('h-name').value; 
    const date = document.getElementById('h-date').value; 
    const originalName = document.getElementById('edit-original-name').value; 
    const originalDate = document.getElementById('edit-original-date').value;
    
    if (!name || !date) { Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบ', 'warning'); return; }
    
    const btn = document.getElementById('btn-save-holiday'); 
    btn.disabled = true; 
    btn.innerText = '...';
    
    const payload = originalName ? { oldName: originalName, oldDate: originalDate, newName: name, newDate: date } : { name: name, date: date }; 
    const method = originalName ? 'editHoliday' : 'addHoliday';
    
    try { 
        const res = await apiCall(method, payload); 
        btn.disabled = false; 
        if (res.success) { 
            Swal.fire('สำเร็จ', res.message, 'success'); 
            resetHolidayForm(); 
            loadHolidaysForModal(currentManageYear); 
        } else { 
            Swal.fire('Error', res.message, 'error'); 
        } 
    } catch(e) {}
}

function deleteHolidayFunc(date, name) {
    Swal.fire({ title: `ลบ '${name}'?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async (r) => { 
        if(r.isConfirmed) { 
            try { 
                const res = await apiCall('deleteHoliday', date); 
                if(res.success) { Swal.fire('ลบแล้ว', res.message, 'success'); loadHolidaysForModal(currentManageYear); } 
            } catch(e){} 
        } 
    });
}

function showStatus(el, message, isSuccess) { 
    if(!el) return; 
    el.innerText = message; 
    el.className = 'status-bar ' + (isSuccess ? 'success' : 'error'); 
    el.style.display = 'inline-block'; 
    setTimeout(() => { el.style.display = 'none'; }, 3000); 
}

async function loadPendingRequests(){ 
    const tbody = document.getElementById("pending-requests-tbody"); 
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#aaa;">กำลังโหลด...</td></tr>'; 
    try { 
        const res = await apiCall('getInitialAdminData'); 
        displayRequests(res); 
    } catch(e){}
}

function displayRequests(response){ 
    const tbody = document.getElementById("pending-requests-tbody"); 
    tbody.innerHTML = ""; 
    
    if (!response.success) { handleLogout(); return; } 
    
    const requests = response.data.pendingRequests; 
    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#aaa;">ไม่มีรายการรออนุมัติ</td></tr>'; 
        return;
    } 
    
    requests.forEach(req => { 
        const row = document.createElement("tr"); 
        const reasonText = req.reason || "-"; 
        const safeReasonEncoded = encodeURIComponent(reasonText);
        row.innerHTML = `
            <td data-label="เลือก"><input type="checkbox" class="request-checkbox" value="${req.requestID}" style="width:18px; height:18px;"></td>
            <td data-label="ID" style="font-family:monospace; color:#aaa;">${req.requestID}</td>
            <td data-label="ชื่อ">${req.fullName}</td>
            <td data-label="ประเภท"><span style="background:rgba(59, 130, 246, 0.15); color:#93c5fd; padding:3px 8px; border-radius:4px; font-size:0.85em;">${req.leaveType}</span></td>
            <td data-label="เริ่ม" class="date-col">${req.startDate}</td>
            <td data-label="สิ้นสุด" class="date-col">${req.endDate}</td>
            <td data-label="วัน" style="font-weight:bold;">${req.totalDays}</td>
            <td data-label="เหตุผล" class="truncate-cell" onclick="viewReason('${safeReasonEncoded}')">${reasonText}</td>
        `; 
        tbody.appendChild(row); 
    }); 
}

function viewReason(encodedText) { 
    Swal.fire({ title: 'เหตุผลการลา', text: decodeURIComponent(encodedText), confirmButtonColor: '#3b82f6' }); 
}

function toggleSelectAll(event){ 
    document.querySelectorAll("#pending .request-checkbox").forEach(cb => cb.checked = event.target.checked); 
}

function processSelected(action){ 
    const requestIds = Array.from(document.querySelectorAll("#pending .request-checkbox:checked")).map(cb => cb.value); 
    if (requestIds.length === 0) { Swal.fire('แจ้งเตือน','กรุณาเลือกรายการก่อน','warning'); return; } 
    
    Swal.fire({
        title: 'ยืนยันการทำรายการ', 
        text: `ต้องการ ${action==='approve'?'อนุมัติ':'ปฏิเสธ'} ${requestIds.length} รายการ?`, 
        icon: 'question', 
        showCancelButton: true
    }).then(async (r)=>{
        if(r.isConfirmed) { 
            const statusBar = document.getElementById("status-bar"); 
            showStatus(statusBar, "กำลังประมวลผล...", true);
            try { 
                const method = action === 'approve' ? 'approveRequests' : 'rejectRequests'; 
                const res = await apiCall(method, requestIds); 
                showStatus(statusBar, res.message, res.success); 
                if (res.success) loadPendingRequests(); 
            } catch(e){} 
        }
    });
}

async function loadSummaryReport(){ 
    const tbody = document.getElementById("summary-tbody"); 
    tbody.innerHTML='<tr><td colspan="9" style="text-align:center; padding:30px;">กำลังโหลด...</td></tr>'; 
    const selectedYear = document.getElementById("report-year-select").value;
    try { 
        const res = await apiCall('getLeaveSummaryReport', selectedYear); 
        if(res.success){ fullSummaryData = res.data; filterSummaryTable(); } 
    } catch(e){}
}

function filterSummaryTable() { 
    const filter = document.getElementById('summary-search-input').value.toLowerCase(); 
    filteredSummaryData = fullSummaryData.filter(user => user.fullName.toLowerCase().includes(filter)); 
    renderSummaryPage(1); 
}

function renderSummaryPage(page) { 
    summaryCurrentPage = page; 
    const pageSize = parseInt(document.getElementById("summary-page-size").value); 
    const tbody = document.getElementById("summary-tbody"); 
    const pageInfo = document.getElementById("summary-page-info"); 
    const prevBtn = document.getElementById("summary-prev-btn"); 
    const nextBtn = document.getElementById("summary-next-btn"); 
    
    tbody.innerHTML = ""; 
    const totalRecords = filteredSummaryData.length; 
    const totalPages = Math.ceil(totalRecords / pageSize) || 1; 
    
    if (totalRecords === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:#aaa;">ไม่พบข้อมูล</td></tr>'; 
        pageInfo.innerText = ""; return;
    } 
    
    const pagedData = filteredSummaryData.slice((page - 1) * pageSize, page * pageSize); 
    pagedData.forEach(user => { 
        const row = document.createElement('tr'); 
        row.innerHTML = `
            <td><a href="#" class="truncate-cell" onclick="showUserHistoryOnClick('${user.userID}', '${user.fullName}'); return false;">${user.fullName}</a></td>
            <td class="text-center">${user["ลาพักร้อน"]}</td>
            <td class="text-center">${user["ลากิจ (ไม่หักเงิน)"]}</td>
            <td class="text-center">${user["ลากิจ (หักเงิน)"]}</td>
            <td class="text-center">${user["ลาป่วย (ไม่มีใบรับรองแพทย์)"]}</td>
            <td class="text-center">${user["ลาป่วย (มีใบรับรองแพทย์)"]}</td>
            <td class="text-center">${user["ลาบวช"]}</td>
            <td class="text-center">${user["ลาช่วยภรรยาคลอดบุตร"]}</td>
            <td class="text-center">${user["ลาคลอด"]}</td>
        `; 
        tbody.appendChild(row); 
    }); 
    
    pageInfo.innerText = `หน้า ${summaryCurrentPage}/${totalPages}`; 
    prevBtn.disabled = summaryCurrentPage === 1; 
    nextBtn.disabled = summaryCurrentPage >= totalPages; 
}

function showUserHistoryOnClick(userId, fullName) { 
    document.getElementById('history-header').innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ประวัติ: <span style="color:var(--primary)">${fullName}</span>`; 
    const selectedYear = document.getElementById("report-year-select").value || new Date().getFullYear(); 
    currentSearchStartDate = `${selectedYear}-01-01`; 
    currentSearchEndDate = `${selectedYear}-12-31`; 
    document.querySelectorAll('.quick-filter-controls button').forEach(btn => btn.classList.remove('active')); 
    document.getElementById('custom-range-controls').style.display = 'none'; 
    loadHistoryPage(1, userId); 
}

function quickSearch(period, element) { 
    document.querySelectorAll('.quick-filter-controls button').forEach(btn => btn.classList.remove('active')); 
    if (element) element.classList.add('active'); 
    document.getElementById('custom-range-controls').style.display = 'none'; 
    
    const today = new Date(); let startDate, endDate; 
    switch (period) { 
        case 'today': startDate = new Date(new Date().setHours(0,0,0,0)); endDate = new Date(new Date().setHours(23,59,59,999)); break; 
        case 'week': const day = today.getDay(); const diff = today.getDate() - day + (day === 0 ? -6 : 1); startDate = new Date(new Date().setDate(diff)); endDate = new Date(new Date(startDate).setDate(startDate.getDate() + 6)); break; 
        case 'month': startDate = new Date(today.getFullYear(), today.getMonth(), 1); endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); break; 
        case 'year': startDate = new Date(today.getFullYear(), 0, 1); endDate = new Date(today.getFullYear(), 11, 31); break; 
    } 
    currentSearchStartDate = startDate.toLocaleDateString('en-CA'); 
    currentSearchEndDate = endDate.toLocaleDateString('en-CA'); 
    document.getElementById('history-header').innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ประวัติการลา`; 
    loadHistoryPage(1, null); 
}

function toggleCustomRange(element) { 
    document.querySelectorAll('.quick-filter-controls button').forEach(btn => btn.classList.remove('active')); 
    if (element) element.classList.add('active'); 
    document.getElementById('custom-range-controls').style.display = 'flex'; 
}

function searchByCustomRange() { 
    const startDate = document.getElementById("search-start").value; 
    const endDate = document.getElementById("search-end").value; 
    if (!startDate || !endDate) { Swal.fire('','เลือกช่วงวันให้ครบ','warning'); return; } 
    currentSearchStartDate = startDate; 
    currentSearchEndDate = endDate; 
    loadHistoryPage(1, null); 
}

async function loadHistoryPage(page, userId = null) { 
    if (!currentSearchStartDate || !currentSearchEndDate) { quickSearch('month', document.querySelector('#qf-month')); return; } 
    const pageSize = document.getElementById("results-per-page").value; 
    historyCurrentPage = page; 
    const tbody = document.getElementById("history-tbody"); 
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#aaa;">กำลังค้นหา...</td></tr>'; 
    const criteria = { startDate: currentSearchStartDate, endDate: currentSearchEndDate, page: page, pageSize: pageSize }; 
    if (userId) criteria.userID = userId; 
    try { 
        const res = await apiCall('searchLeaveHistory', criteria); 
        displayHistory(res); 
    } catch(e){}
}

function displayHistory(response) { 
    if (!response.success) { return; } 
    const data = response.data; 
    currentHistoryList = data.data; 
    const tbody = document.getElementById("history-tbody"), 
          pageInfo = document.getElementById("page-info"), 
          prevBtn = document.getElementById("prev-btn"), 
          nextBtn = document.getElementById("next-btn"), 
          pageSize = parseInt(document.getElementById("results-per-page").value); 
          
    tbody.innerHTML = ""; 
    if (0 === data.totalRecords) { 
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#aaa;">ไม่พบข้อมูล</td></tr>'; 
        pageInfo.innerText = ""; return; 
    } 
    const totalPages = Math.ceil(data.totalRecords / pageSize) || 1;
    
    data.data.forEach((item, index) => { 
        const row = document.createElement("tr"); 
        row.className = "clickable-row"; 
        row.onclick = () => openHistoryDetail(index); 
        const reasonText = item.reason || "-"; 
        row.innerHTML = `
            <td data-label="ID" style="font-family:monospace; color:#aaa;">${item.requestID}</td>
            <td data-label="ชื่อ-สกุล">${item.fullName}</td>
            <td data-label="ประเภท"><span style="font-size:0.9em;">${item.leaveType}</span></td> 
            <td data-label="เริ่ม" class="date-col">${item.startDate}</td>
            <td data-label="สิ้นสุด" class="date-col">${item.endDate}</td>
            <td data-label="สาเหตุการลา" class="truncate-cell">${reasonText}</td>
        `; 
        tbody.appendChild(row); 
    }); 
    
    pageInfo.innerText = `หน้า ${historyCurrentPage}/${totalPages}`; 
    prevBtn.disabled = 1 === historyCurrentPage; 
    nextBtn.disabled = historyCurrentPage >= totalPages; 
}

function openHistoryDetail(index) {
    const item = currentHistoryList[index]; if(!item) return;
    document.getElementById('hd-id').innerText = item.requestID; 
    document.getElementById('hd-name').innerText = item.fullName; 
    document.getElementById('hd-type').innerText = item.leaveType + (item.leaveUnit ? ` (${item.leaveUnit})` : ''); 
    document.getElementById('hd-date-range').innerText = `${item.startDate} ถึง ${item.endDate}`; 
    document.getElementById('hd-location').innerText = item.location || '-'; 
    document.getElementById('hd-actual-days').innerText = item.actualDays + " วัน"; 
    document.getElementById('hd-deduct-dates').innerText = item.deductionDates || "-";
    
    const holZone = document.getElementById('hd-holiday-zone'); 
    if(item.holidayCount > 0) { 
        holZone.style.display = 'block'; 
        document.getElementById('hd-total-holidays').innerText = item.holidayCount + " วัน"; 
        document.getElementById('hd-holiday-found').innerText = item.holidayFound || "-"; 
    } else { 
        holZone.style.display = 'none'; 
    }
    
    document.getElementById('hd-timestamp').innerText = item.timestamp; 
    const statusEl = document.getElementById('hd-status'); 
    statusEl.innerText = item.status; 
    statusEl.style.color = (item.status === 'Approved') ? '#10b981' : (item.status === 'Rejected' || item.status === 'Canceled') ? '#ef4444' : '#f59e0b'; 
    document.getElementById('hd-reason').innerText = item.reason || '-';
    
    const actionZone = document.getElementById('hd-action-zone'); 
    const cancelBtn = document.getElementById('hd-admin-cancel-btn'); 
    if (item.status === 'Approved') { 
        actionZone.style.display = 'block'; 
        cancelBtn.onclick = () => adminCancelApprovedLeave(item.requestID, item.fullName); 
    } else { 
        actionZone.style.display = 'none'; 
    } 
    document.getElementById('history-detail-modal').style.display = 'block';
}

function closeHistoryModal() { 
    document.getElementById('history-detail-modal').style.display = 'none'; 
}

function adminCancelApprovedLeave(requestID, fullName) { 
    Swal.fire({ 
        title: 'ยกเลิกใบลา?', 
        text: `ของ ${fullName} (ID: ${requestID})`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33' 
    }).then(async r => { 
        if(r.isConfirmed) { 
            closeHistoryModal(); 
            Swal.fire({title:'กำลังประมวลผล', didOpen:()=>Swal.showLoading()}); 
            try { 
                const res = await apiCall('adminCancelLeave', requestID); 
                Swal.fire('เรียบร้อย', res.message, res.success?'success':'error'); 
                if (res.success) { loadSummaryReport(); loadHistoryPage(historyCurrentPage); } 
            } catch(e){} 
        } 
    });
}

async function loadUsers() { 
    const tbody = document.getElementById("users-tbody"); 
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:#aaa;">กำลังโหลด...</td></tr>'; 
    try { 
        const res = await apiCall('getUsers'); 
        if(res.success){ allUsersData = res.data; filterUsersTable(); } 
    } catch(e){}
}

function filterUsersTable() { 
    const filter = document.getElementById('user-search-input').value.toLowerCase(); 
    filteredUsersData = allUsersData.filter(user => { 
        const uID = String(user.userID || "").toLowerCase(); 
        const uName = String(user.fullName || "").toLowerCase(); 
        return uID.includes(filter) || uName.includes(filter); 
    }); 
    renderUsersTable(1); 
}

function renderUsersTable(page) {
    usersCurrentPage = page; 
    const pageSizeStr = document.getElementById("users-page-size").value; 
    const tbody = document.getElementById("users-tbody"); 
    const pageInfo = document.getElementById("users-page-info"); 
    const prevBtn = document.getElementById("users-prev-btn"); 
    const nextBtn = document.getElementById("users-next-btn"); 
    tbody.innerHTML = ""; 
    const totalRecords = filteredUsersData.length;
    
    if (totalRecords === 0) { 
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px; color:#aaa;">ไม่พบข้อมูล</td></tr>'; 
        pageInfo.innerText = ""; return; 
    }
    
    let pagedData = [], totalPages = 1; 
    if (pageSizeStr === 'all') { 
        pagedData = filteredUsersData; 
    } else { 
        const pageSize = parseInt(pageSizeStr); 
        totalPages = Math.ceil(totalRecords / pageSize) || 1; 
        if (usersCurrentPage > totalPages) usersCurrentPage = totalPages; 
        const startIndex = (usersCurrentPage - 1) * pageSize; 
        pagedData = filteredUsersData.slice(startIndex, startIndex + pageSize); 
    }
    
    pagedData.forEach(user => { 
        const row = document.createElement("tr"); 
        let displayName = user.fullName; 
        if(user.nickname) { displayName += " (" + user.nickname + ")"; } 
        let statusColor = (user.status === 'Disabled') ? '#ef4444' : '#10b981'; 
        row.innerHTML = `
            <td data-label="UserID" style="font-family:monospace;">${user.userID}</td>
            <td data-label="ชื่อ-สกุล">${displayName}</td>
            <td data-label="Username">${user.username}</td>
            <td data-label="เพศ">${user.gender}</td>
            <td data-label="พักร้อน">${user.vacationQuota}</td>
            <td data-label="กิจ(หัก)">${user.personalLeaveDeductQuota}</td>
            <td data-label="Admin">${user.isAdmin ? '<i class="fa-solid fa-check" style="color:#10b981;"></i>' : '-'}</td>
            <td data-label="สถานะ" style="font-weight:bold; color:${statusColor}">${user.status || 'Active'}</td>
            <td data-label="จัดการ">
                <button class="edit-btn" style="padding:4px 8px; font-size:12px;"><i class="fa-solid fa-pen"></i></button> 
                <button class="delete-btn" style="padding:4px 8px; font-size:12px;"><i class="fa-solid fa-trash"></i></button>
            </td>
        `; 
        row.querySelector(".edit-btn").onclick = () => openUserModal(user); 
        row.querySelector(".delete-btn").onclick = () => confirmDeleteUser(user.userID, user.fullName); 
        tbody.appendChild(row); 
    });
    
    pageInfo.innerText = `หน้า ${usersCurrentPage}/${totalPages}`; 
    if (pageSizeStr === 'all') { 
        prevBtn.disabled = true; nextBtn.disabled = true; 
    } else { 
        prevBtn.disabled = usersCurrentPage === 1; nextBtn.disabled = usersCurrentPage >= totalPages; 
    }
}

function openUserModal(user = null) { 
    const modal = document.getElementById("user-modal"); 
    modal.style.display = "block"; 
    const title = modal.querySelector("#modal-title"), 
          userIdField = modal.querySelector("#user-id-edit"), 
          fullNameField = modal.querySelector("#user-fullName"), 
          nicknameField = modal.querySelector("#user-nickname"), 
          usernameField = modal.querySelector("#user-username"), 
          passwordField = modal.querySelector("#user-password"), 
          genderField = modal.querySelector("#user-gender"), 
          isAdminField = modal.querySelector("#user-isAdmin"), 
          vacationQuotaField = modal.querySelector("#user-vacationQuota"), 
          personalLeaveDeductQuotaField = modal.querySelector("#user-personalLeaveDeductQuota"); 
          
    if (user) { 
        title.innerText = "แก้ไขข้อมูล"; userIdField.value = user.userID; fullNameField.value = user.fullName; nicknameField.value = user.nickname || ""; usernameField.value = user.username; usernameField.disabled = true; genderField.value = user.gender; isAdminField.checked = user.isAdmin; vacationQuotaField.value = user.vacationQuota; personalLeaveDeductQuotaField.value = user.personalLeaveDeductQuota; passwordField.value = ""; 
    } else { 
        title.innerText = "เพิ่มผู้ใช้"; userIdField.value = ""; fullNameField.value = ""; nicknameField.value = ""; usernameField.value = ""; usernameField.disabled = false; passwordField.value = ""; genderField.value = "ชาย"; isAdminField.checked = false; vacationQuotaField.value = "6"; personalLeaveDeductQuotaField.value = "30"; 
    } 
}

function closeUserModal() { 
    document.getElementById("user-modal").style.display = "none"; 
}

async function saveUser() { 
    const userData = { 
        userID: document.getElementById("user-id-edit").value, 
        fullName: document.getElementById("user-fullName").value, 
        nickname: document.getElementById("user-nickname").value, 
        username: document.getElementById("user-username").value, 
        password: document.getElementById("user-password").value, 
        gender: document.getElementById("user-gender").value, 
        isAdmin: document.getElementById("user-isAdmin").checked, 
        vacationQuota: document.getElementById("user-vacationQuota").value, 
        personalLeaveDeductQuota: document.getElementById("user-personalLeaveDeductQuota").value 
    }; 
    
    if (!userData.fullName || !userData.username) { Swal.fire('','ข้อมูลไม่ครบ','warning'); return } 
    const serverFunction = userData.userID ? "updateUser" : "addUser"; 
    if (serverFunction === 'addUser' && !userData.password) { Swal.fire('','กรุณาตั้งรหัสผ่าน','warning'); return } 
    
    try { 
        const res = await apiCall(serverFunction, userData); 
        Swal.fire('สำเร็จ', res.message, 'success'); 
        if (res.success) { closeUserModal(); loadUsers(); } 
    } catch(e) { Swal.fire('Error', e.message, 'error') }
}

function confirmDeleteUser(userID, fullName) { 
    Swal.fire({title:`ลบ '${fullName}'?`, icon:'warning', showCancelButton:true, confirmButtonColor:'#d33'}).then(async r=>{
        if(r.isConfirmed){ 
            try{
                const res = await apiCall('deleteUser', userID); 
                Swal.fire('ลบแล้ว',res.message,'success'); 
                if (res.success) loadUsers()
            }catch(e){} 
        }
    }) 
}

function populateYearSelect() { 
    const select = document.getElementById("reset-year-select"); 
    const currentYear = new Date().getFullYear(); 
    [currentYear - 1, currentYear].forEach(year => { 
        const option = document.createElement("option"); 
        option.value = year; option.text = year; 
        if (year === currentYear - 1) option.selected = true; 
        select.appendChild(option); 
    }); 
}

function confirmReset() { 
    const selectedYear = document.getElementById("reset-year-select").value; 
    Swal.fire({ 
        title: `รีเซ็ตข้อมูลปี ${selectedYear}?`, 
        html: `ข้อมูลเก่าจะถูกย้ายไปเก็บถาวร<br>และชีตจะถูกเตรียมพร้อมสำหรับปีใหม่`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33', 
        confirmButtonText: 'ยืนยันการรีเซ็ต' 
    }).then(async r=>{
        if(r.isConfirmed){
            Swal.fire({title:'กำลังประมวลผล', didOpen:()=>Swal.showLoading()});
            try{ 
                const res = await apiCall('performAnnualLeaveReset', parseInt(selectedYear)); 
                Swal.fire('เสร็จสิ้น', res.message, 'success'); 
                if(res.success) { loadPendingRequests(); loadSummaryReport(); } 
            } catch(e){} 
        }
    });
}

async function handleExportExcel() {
    const start = document.getElementById('export-start-date').value; 
    const end = document.getElementById('export-end-date').value;
    
    if (!start || !end) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกตั้งแต่วันที่ และ ถึงวันที่ ให้ครบถ้วน', 'warning'); return; }
    
    const sDate = new Date(start); const eDate = new Date(end); 
    const diffDays = Math.ceil(Math.abs(eDate - sDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 60) { Swal.fire('แจ้งเตือน', 'ช่วงเวลาการดึงข้อมูลต้องไม่เกิน 60 วัน เพื่อป้องกันระบบค้าง', 'warning'); return; }
    
    const btn = document.getElementById('export-excel-btn'); 
    const originalText = btn.innerHTML; 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...'; 
    btn.disabled = true;

    try {
        const res = await apiCall('exportLeaveDailySummary', {start: start, end: end});
        btn.innerHTML = originalText; 
        btn.disabled = false;
        
        if (res.success) {
            try {
                const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' }); 
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a"); 
                link.style.display = 'none'; 
                link.href = url; 
                link.download = res.filename;
                
                document.body.appendChild(link); 
                link.click(); 
                setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 15000); 
                
                Swal.fire('สำเร็จ', 'ดาวน์โหลดรายงานเรียบร้อยแล้ว', 'success');
            } catch (e) { Swal.fire('Error', 'ไม่สามารถสร้างไฟล์ได้: ' + e.message, 'error'); }
        } else { Swal.fire('Error', res.message, 'error'); }
    } catch(err) { 
        btn.innerHTML = originalText; 
        btn.disabled = false; 
        Swal.fire('Error', err.message, 'error'); 
    }
}