/**
 * Oracle-X Desktop — 通用工具函数
 * 分页器、状态提示、格式化
 */

// ==================== 通用分页器 ====================
const paginationState = {};

function renderPagination(containerId, totalItems, perPage, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / perPage);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const start = (currentPage - 1) * perPage + 1;
    const end = Math.min(currentPage * perPage, totalItems);

    let buttonsHtml = '';

    // Prev button
    buttonsHtml += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹</button>`;

    // Page numbers with ellipsis
    const pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (currentPage > 3) pages.push('...');
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            pages.push(i);
        }
        if (currentPage < totalPages - 2) pages.push('...');
        pages.push(totalPages);
    }

    pages.forEach(p => {
        if (p === '...') {
            buttonsHtml += '<span class="pagination-ellipsis">…</span>';
        } else {
            buttonsHtml += `<button class="${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
        }
    });

    // Next button
    buttonsHtml += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">›</button>`;

    container.innerHTML = `
    <span class="pagination-info">${start}-${end} / ${totalItems}</span>
    <div class="pagination-buttons">${buttonsHtml}</div>
  `;

    container.querySelectorAll('.pagination-buttons button').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (!isNaN(page) && page >= 1 && page <= totalPages) {
                onPageChange(page);
            }
        });
    });
}

// ==================== 状态提示 ====================
function showStatus(nearElementId, text, type = 'success') {
    const el = document.getElementById(nearElementId);
    if (!el) return;
    const span = document.createElement('span');
    span.className = `status ${type}`;
    span.textContent = text;
    el.parentElement.appendChild(span);
    setTimeout(() => span.remove(), 3000);
}

// ==================== 格式化持仓时间 ====================
function formatHoldTime(hours) {
    if (hours < 1) return t('time.minutes', { n: Math.round(hours * 60) });
    if (hours < 24) return t('time.hours', { n: hours.toFixed(1) });
    if (hours < 24 * 30) return t('time.days', { n: (hours / 24).toFixed(1) });
    return t('time.months', { n: (hours / 24 / 30).toFixed(1) });
}
