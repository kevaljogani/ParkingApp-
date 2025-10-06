const apiBase = '/api/parking';
let state = null;

/* ---------- helper ---------- */
function escapeHtml(s) {
    if (!s) return '';
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function fmtDateTime(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleString();
}
function fmtMinutes(mins) {
    if (mins == null) return '';
    const m = Math.round(mins);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h} h ${r} min`;
}

/* ---------- fetch / render ---------- */
async function fetchState() {
    try {
        const res = await fetch(`${apiBase}/state`);
        if (!res.ok) throw new Error('Failed to fetch state');
        state = await res.json();
        renderAll();
    } catch (e) {
        console.error(e);
        document.getElementById('ticketsList').innerText = 'Failed to load';
    }
}

function renderAll() {
    renderSlots();
    renderTickets();
    renderSummary();
}

function renderSlots() {
    const grid = document.getElementById('slotsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const slots = state.slots || [];
    slots.forEach(s => {
        const el = document.createElement('div');
        el.className = `slot ${s.occupied ? 'occupied' : 'free'}`;
        el.style = 'border:1px solid #ddd; padding:10px; border-radius:6px; text-align:center;';
        el.innerHTML = `<div style="font-weight:bold">${escapeHtml(s.name)}</div>
                        <div style="margin-top:8px;">${s.occupied ? 'Occupied' : 'Free'}</div>`;

        // If occupied, add Release button
        if (s.occupied) {
            const btn = document.createElement('button');
            btn.innerText = 'Release';
            btn.style.marginTop = '8px';
            btn.onclick = () => showReleaseConfirm(s);
            el.appendChild(btn);
        } else {
            const btn = document.createElement('button');
            btn.innerText = 'Occupy';
            btn.style.marginTop = '8px';
            btn.onclick = () => openOccupyModal(s.id);
            el.appendChild(btn);
        }

        grid.appendChild(el);
    });
}

function renderTickets() {
    const container = document.getElementById('ticketsList');
    container.innerHTML = '';
    const tickets = state.tickets || [];

    if (!tickets.length) {
        container.innerHTML = '<div>No tickets yet</div>';
        return;
    }

    tickets.forEach(t => {
        const item = document.createElement('div');
        item.className = 'ticket';
        item.style = 'border-bottom:1px solid #eee; padding:8px 0;';

        const dur = t.durationMinutes != null ? fmtMinutes(t.durationMinutes) : (t.exitTime ? fmtMinutes((new Date(t.exitTime) - new Date(t.timestamp)) / 60000) : '');
        item.innerHTML = `<div><b>${escapeHtml(t.ownerName || t.carNumber)}</b> <span style="color:#666; font-size:12px;">(${escapeHtml(t.carNumber || '')})</span></div>
                          <div style="font-size:12px; color:#555;">Slot: ${t.slotId} • In: ${fmtDateTime(t.timestamp)} ${t.exitTime ? ' • Out: ' + fmtDateTime(t.exitTime) : ''}</div>
                          <div style="font-size:12px; color:#333; margin-top:6px;">Duration: ${dur || '-'}</div>`;

        container.appendChild(item);
    });

    // wire search filter
    filterTickets();
}

function renderSummary() {
    const panel = document.getElementById('summaryPanel');
    panel.innerHTML = '';

    const stats = state.stats || {};
    const totalToday = stats.totalToday ?? 0;
    const peak = stats.peakOccupancy ?? 0;
    const avg = stats.averageParkingMinutes ?? null;
    const current = stats.currentOccupied ?? (state.slots ? state.slots.filter(s => s.occupied).length : 0);

    panel.innerHTML = `
        <div><b>Cars today:</b> ${totalToday}</div>
        <div><b>Current occupied:</b> ${current}</div>
        <div><b>Peak occupancy:</b> ${peak}</div>
        <div><b>Average parking:</b> ${avg != null ? fmtMinutes(avg) : '-'}</div>
    `;
}

/* ---------- slot click handlers (release flow) ---------- */
function showReleaseConfirm(slot) {
    const modal = document.getElementById('releaseModal');
    if (!modal) return;
    const confirmText = document.getElementById('confirmText');
    confirmText.innerText = `Are you sure you want to release ${slot.name}?`;
    modal.style.display = 'block';

    const confirmBtn = document.getElementById('confirmRelease');
    const cancelBtn = document.getElementById('confirmCancel');

    const onConfirm = async () => {
        confirmBtn.disabled = true;
        try {
            const res = await fetch(`${apiBase}/release`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slotId: slot.id })
            });
            if (!res.ok) {
                const text = await res.text();
                alert('Failed to release: ' + text);
            } else {
                const data = await res.json();
                if (data.state) state = data.state;
                renderAll();

                if (data.releasedTicket && data.releasedTicket.exitTime) {
                    const durMins = (new Date(data.releasedTicket.exitTime) - new Date(data.releasedTicket.timestamp)) / 60000;
                    alert(`Released. Parking duration: ${fmtMinutes(durMins)}`);
                } else {
                    alert('Released.');
                }
            }
        } catch (e) {
            console.error(e);
            alert('Error releasing slot');
        } finally {
            confirmBtn.disabled = false;
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
        }
    };

    const onCancel = () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
}

/* ---------- occupy modal logic ---------- */
function openOccupyModal(slotId) {
    const modal = document.getElementById('modal');
    if (!modal) return;
    document.getElementById('slotId').value = slotId;
    document.getElementById('carNumber').value = '';
    document.getElementById('ownerName').value = '';
    document.getElementById('phone').value = '';
    modal.style.display = 'block';
}

function closeOccupyModal() {
    const modal = document.getElementById('modal');
    if (!modal) return;
    modal.style.display = 'none';
}

async function submitOccupy() {
    const slotId = parseInt(document.getElementById('slotId').value);
    const carNumber = document.getElementById('carNumber').value.trim();
    const ownerName = document.getElementById('ownerName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    // Validation
    const ownerRegex = /^[a-zA-Z\s]+$/;
    const phoneRegex = /^[0-9]+$/;
    if (!ownerRegex.test(ownerName)) {
        alert('Owner name should contain letters only.');
        return;
    }
    if (!phoneRegex.test(phone)) {
        alert('Phone number should contain digits only.');
        return;
    }

    try {
        const res = await fetch(`${apiBase}/occupy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slotId, carNumber, ownerName, phone })
        });
        if (!res.ok) {
            const text = await res.text();
            alert('Failed to occupy: ' + text);
        } else {
            await fetchState();
            closeOccupyModal();
        }
    } catch (e) {
        console.error(e);
        alert('Error occupying slot');
    }
}

/* ---------- search/filter ---------- */
function filterTickets() {
    const q = document.getElementById('searchBox')?.value?.toLowerCase()?.trim();
    const tickets = document.querySelectorAll('#ticketsList .ticket');
    tickets.forEach(ticket => {
        const ownerEl = ticket.querySelector('b');
        const owner = ownerEl ? ownerEl.textContent.toLowerCase() : '';
        const carMatch = ticket.textContent.toLowerCase();
        ticket.style.display = (!q || owner.includes(q) || carMatch.includes(q)) ? '' : 'none';
    });
}

/* ---------- export ---------- */
function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function exportTicketsAsJson() {
    const tickets = state.tickets || [];
    downloadFile(`tickets-${(new Date()).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`, JSON.stringify(tickets, null, 2), 'application/json');
}

function exportTicketsAsCsv() {
    const tickets = state.tickets || [];
    const lines = [];
    lines.push(['SlotId', 'CarNumber', 'OwnerName', 'Phone', 'Timestamp', 'ExitTime', 'DurationMinutes'].join(','));
    tickets.forEach(t => {
        const row = [
            t.slotId,
            `"${(t.carNumber || '').replace(/"/g, '""')}"`,
            `"${(t.ownerName || '').replace(/"/g, '""')}"`,
            `"${(t.phone || '').replace(/"/g, '""')}"`,
            `"${t.timestamp || ''}"`,
            `"${t.exitTime || ''}"`,
            t.durationMinutes != null ? Math.round(t.durationMinutes) : ''
        ];
        lines.push(row.join(','));
    });
    downloadFile(`tickets-${(new Date()).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`, lines.join('\n'), 'text/csv');
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', () => {
    const sb = document.getElementById('searchBox');
    if (sb) sb.addEventListener('input', filterTickets);

    const occSubmit = document.getElementById('occupySubmit');
    const occCancel = document.getElementById('occupyCancel');
    if (occSubmit) occSubmit.addEventListener('click', submitOccupy);
    if (occCancel) occCancel.addEventListener('click', closeOccupyModal);

    const exportCsvBtn = document.getElementById('exportCsv');
    const exportJsonBtn = document.getElementById('exportJson');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportTicketsAsCsv);
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportTicketsAsJson);

    fetchState();
});
