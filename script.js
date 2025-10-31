// script.js (module) - Firestore-backed dashboard with cascade delete

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";

import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-analytics.js";

import {

  getFirestore, collection, addDoc, onSnapshot, serverTimestamp,

  query, orderBy, deleteDoc, doc, updateDoc, getDocs, where, writeBatch, getDoc

} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// --- firebaseConfig (your provided config) ---

const firebaseConfig = {

  apiKey: "AIzaSyCMhwCdyBmC3037SScytAYGmiXXnFiwFbI",

  authDomain: "request-materials-4b168.firebaseapp.com",

  projectId: "request-materials-4b168",

  storageBucket: "request-materials-4b168.firebasestorage.app",

  messagingSenderId: "1088278709255",

  appId: "1:1088278709255:web:138e1337bea754b21c16a2",

  measurementId: "G-F4FR8YJD99"

};

const app = initializeApp(firebaseConfig);

try { getAnalytics(app); } catch(e){ /* ignore analytics errors in some envs */ }

const db = getFirestore(app);

// Collections

const requestsCol = collection(db, "requests");

const deliveredCol = collection(db, "delivered");

const usageCol = collection(db, "usage");

// ---------- UI refs ----------

const submitRequestBtn = document.getElementById("submitRequestBtn");

const submitModal = document.getElementById("submitModal");

const exitModalBtn = document.getElementById("exitModalBtn");

const submitDataBtn = document.getElementById("submitDataBtn");

const dateEl = document.getElementById("date");

const personnelEl = document.getElementById("personnel");

const particularEl = document.getElementById("particular");

const unitEl = document.getElementById("unit");

const qtyEl = document.getElementById("qty");

const toastEl = document.getElementById("toast");

const viewRequestBtn = document.getElementById("viewRequestBtn");

const viewRequestModal = document.getElementById("viewRequestModal");

const requestsTbody = document.getElementById("requestsTbody");

const closeRequestsBtn = document.getElementById("closeRequestsBtn");

const openAddDeliveredFromRequestsBtn = document.getElementById("openAddDeliveredFromRequestsBtn");

const openAddUsageFromRequestsBtn = document.getElementById("openAddUsageFromRequestsBtn");

const viewDeliveredBtn = document.getElementById("viewDeliveredBtn");

const deliveredModal = document.getElementById("deliveredModal");

const deliveredTbody = document.getElementById("deliveredTbody");

const closeDeliveredBtn = document.getElementById("closeDeliveredBtn");

const addDeliveredBtn = document.getElementById("addDeliveredBtn");

const editDeliveredModal = document.getElementById("editDeliveredModal");

const editDeliveredTitle = document.getElementById("editDeliveredTitle");

const deliveredRequestSelect = document.getElementById("deliveredRequestSelect");

const editDeliveredParticular = document.getElementById("editDeliveredParticular");

const editDeliveredUnit = document.getElementById("editDeliveredUnit");

const editDeliveredQty = document.getElementById("editDeliveredQty");

const saveDeliveredBtn = document.getElementById("saveDeliveredBtn");

const cancelEditDeliveredBtn = document.getElementById("cancelEditDeliveredBtn");

const viewRemainingBtn = document.getElementById("viewRemainingBtn");

const remainingModal = document.getElementById("remainingModal");

const remainingTbody = document.getElementById("remainingTbody");

const closeRemainingBtn = document.getElementById("closeRemainingBtn");

const viewUsageBtn = document.getElementById("viewUsageBtn");

const usageModal = document.getElementById("usageModal");

const usageTbody = document.getElementById("usageTbody");

const closeUsageBtn = document.getElementById("closeUsageBtn");

const addUsageBtn = document.getElementById("addUsageBtn");

const editUsageModal = document.getElementById("editUsageModal");

const editUsageTitle = document.getElementById("editUsageTitle");

const usageRequestSelect = document.getElementById("usageRequestSelect");

const editUsageParticular = document.getElementById("editUsageParticular");

const editUsageUnit = document.getElementById("editUsageUnit");

const editUsageQty = document.getElementById("editUsageQty");

const editUsageRemarks = document.getElementById("editUsageRemarks");

const saveUsageBtn = document.getElementById("saveUsageBtn");

const cancelEditUsageBtn = document.getElementById("cancelEditUsageBtn");

const viewHistoryBtn = document.getElementById("viewHistoryBtn");

const historyModal = document.getElementById("historyModal");

const historyTbody = document.getElementById("historyTbody");

const closeHistoryBtn = document.getElementById("closeHistoryBtn");

// editing state

let editingDeliveredId = null;

let editingUsageId = null;

// ---------- helpers ----------

function openModal(el){

  el.classList.add("fullscreen");   // make modal fullscreen (CSS handles .modal.fullscreen .card)

  el.style.display = "flex";

  el.setAttribute("aria-hidden","false");

  // lock body scroll while modal open

  document.body.style.overflow = "hidden";

}

function closeModal(el){

  el.style.display = "none";

  el.classList.remove("fullscreen");

  el.setAttribute("aria-hidden","true");

  // restore body scroll

  document.body.style.overflow = "";

}

function showToast(msg){ toastEl.textContent = msg; toastEl.className = "show"; setTimeout(()=> toastEl.className = "", 3000); }

function fmtDate(ts){ try{ return ts?.toDate ? ts.toDate().toLocaleString() : new Date(ts).toLocaleString(); } catch(e){ return ""; } }

function escapeHtml(s){ if(!s) return ""; return s.toString().replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

function normKey(s){ return (s||"").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }

// ---------- Submit Request ----------

submitRequestBtn.addEventListener("click", ()=>{

  dateEl.value = new Date().toLocaleString();

  openModal(submitModal);

});

exitModalBtn.addEventListener("click", ()=> closeModal(submitModal));

submitDataBtn.addEventListener("click", async ()=>{

  const personnel = personnelEl.value.trim();

  const particular = particularEl.value.trim();

  const unit = unitEl.value.trim();

  const qty = Number(qtyEl.value);

  if(!personnel || !particular || !unit || !qty || qty <= 0){ showToast("⚠️ Fill all fields"); return; }

  try{

    await addDoc(requestsCol, { personnel, particular, unit, qty, createdAt: serverTimestamp() });

    showToast("✅ Request submitted");

    personnelEl.value = ""; particularEl.value = ""; unitEl.value = ""; qtyEl.value = "";

    closeModal(submitModal);

  } catch(e){ console.error(e); showToast("⚠️ Submit failed"); }

});

// ---------- Requests: live listener (onSnapshot keeps data current) ----------

const requestsQ = query(requestsCol, orderBy("createdAt","desc"));

onSnapshot(requestsQ, snapshot=>{

  // populate requests table

  requestsTbody.innerHTML = "";

  const requestsForSelect = [];

  snapshot.forEach(docSnap=>{

    const d = docSnap.data(); const id = docSnap.id;

    requestsForSelect.push({ id, personnel: d.personnel, particular: d.particular, unit: d.unit, qty: d.qty, createdAt: d.createdAt });

    const date = fmtDate(d.createdAt);

    const tr = document.createElement("tr");

    tr.innerHTML = `

      <td style="text-align:left;padding-left:10px">${escapeHtml(d.personnel)}</td>

      <td style="text-align:left;padding-left:10px">${escapeHtml(d.particular)}</td>

      <td>${escapeHtml(d.unit)}</td>

      <td>${d.qty}</td>

      <td>${date}</td>

      <td>

        <button class="table-btn small-edit" data-id="${id}" data-action="delete">Delete</button>

      </td>

    `;

    requestsTbody.appendChild(tr);

  });

  // bind delete buttons (cascade delete)

  requestsTbody.querySelectorAll("button[data-action='delete']").forEach(btn=>{

    btn.onclick = async () => {

      const id = btn.dataset.id;

      if(!confirm("Delete this request and all related Delivered & Usage records?")) return;

      try{

        await cascadeDeleteRequest(id);

        showToast("✅ Request and related records deleted");

      } catch(err){

        console.error(err);

        showToast("⚠️ Delete failed");

      }

    };

  });

  // fill selects used when creating delivered/usage

  fillRequestSelects(requestsForSelect);

});

// Open View Requests modal (one click)

viewRequestBtn.addEventListener("click", ()=> openModal(viewRequestModal));

closeRequestsBtn.addEventListener("click", ()=> closeModal(viewRequestModal));

// Buttons in requests modal to open add delivered/usage prefilled

openAddDeliveredFromRequestsBtn.addEventListener("click", ()=> {

  editingDeliveredId = null;

  editDeliveredTitle.textContent = "Add Delivered (select request)";

  editDeliveredParticular.value = ""; editDeliveredUnit.value = ""; editDeliveredQty.value = 1;

  openModal(editDeliveredModal);

});

openAddUsageFromRequestsBtn.addEventListener("click", ()=> {

  editingUsageId = null;

  editUsageTitle.textContent = "Add Usage (select request)";

  editUsageParticular.value = ""; editUsageUnit.value = ""; editUsageQty.value = 1; editUsageRemarks.value = "";

  openModal(editUsageModal);

});

// ---------- Cascade delete function ----------

async function cascadeDeleteRequest(requestId){

  // Use a batch to delete the request doc and all delivered & usage docs linked by fromRequestId

  const batch = writeBatch(db);

  // delete the request doc

  const reqRef = doc(db, "requests", requestId);

  batch.delete(reqRef);

  // find delivered docs with fromRequestId == requestId

  const delQ = query(deliveredCol, where("fromRequestId", "==", requestId));

  const delSnap = await getDocs(delQ);

  delSnap.forEach(s => batch.delete(doc(db, "delivered", s.id)));

  // find usage docs with fromRequestId == requestId

  const usageQ = query(usageCol, where("fromRequestId", "==", requestId));

  const usageSnap = await getDocs(usageQ);

  usageSnap.forEach(s => batch.delete(doc(db, "usage", s.id)));

  // commit batch

  await batch.commit();

}

// ---------- Delivered: add/edit/toggle ----------

viewDeliveredBtn.addEventListener("click", ()=> openModal(deliveredModal));

closeDeliveredBtn.addEventListener("click", ()=> closeModal(deliveredModal));

addDeliveredBtn.addEventListener("click", ()=>{

  editingDeliveredId = null;

  editDeliveredTitle.textContent = "Add Delivered";

  deliveredRequestSelect.value = "";

  editDeliveredParticular.value = ""; editDeliveredUnit.value = ""; editDeliveredQty.value = 1;

  openModal(editDeliveredModal);

});

cancelEditDeliveredBtn.addEventListener("click", ()=> closeModal(editDeliveredModal));

saveDeliveredBtn.addEventListener("click", async ()=>{

  const particular = editDeliveredParticular.value.trim();

  const unit = editDeliveredUnit.value.trim();

  const qty = Number(editDeliveredQty.value);

  const linkedRequestId = deliveredRequestSelect.value || null;

  if(!particular || !unit || !qty || qty <= 0){ showToast("⚠️ Fill delivered fields"); return; }

  try{

    if(editingDeliveredId){

      await updateDoc(doc(db, "delivered", editingDeliveredId), { particular, unit, qty, updatedAt: serverTimestamp() });

      showToast("✅ Delivered updated");

    } else {

      await addDoc(deliveredCol, {

        particular, unit, qty, status: "pending", deliveredAt: serverTimestamp(), fromRequestId: linkedRequestId

      });

      showToast("✅ Delivered added");

    }

    closeModal(editDeliveredModal);

  } catch(e){ console.error(e); showToast("⚠️ Save failed"); }

});

// delivered live listener

const deliveredQ = query(deliveredCol, orderBy("deliveredAt","desc"));

onSnapshot(deliveredQ, snapshot=>{

  deliveredTbody.innerHTML = "";

  snapshot.forEach(docSnap=>{

    const d = docSnap.data(); const id = docSnap.id;

    const date = fmtDate(d.deliveredAt);

    const status = d.status || "pending";

    const tr = document.createElement("tr");

    tr.innerHTML = `

      <td style="text-align:left;padding-left:10px">${escapeHtml(d.particular)}</td>

      <td>${escapeHtml(d.unit)}</td>

      <td>${d.qty}</td>

      <td>${escapeHtml(status)}</td>

      <td>${date}</td>

      <td>

        <button class="table-btn small-mark" data-id="${id}" data-action="toggle">${ status === "completed" ? "Mark Pending" : "Mark Completed" }</button>

        <button class="table-btn small-edit" data-id="${id}" data-action="edit">Edit</button>

      </td>

    `;

    deliveredTbody.appendChild(tr);

  });

  deliveredTbody.querySelectorAll("button").forEach(btn=>{

    btn.onclick = async () => {

      const id = btn.dataset.id;

      const action = btn.dataset.action;

      if(action === "toggle"){

        try{

          const ref = doc(db, "delivered", id);

          const snap = await getDoc(ref);

          if(!snap.exists()) return showToast("Record missing");

          const current = snap.data().status || "pending";

          const next = (current === "completed") ? "pending" : "completed";

          await updateDoc(ref, { status: next, updatedAt: serverTimestamp() });

          showToast(`Status set to ${next}`);

        } catch(e){ console.error(e); showToast("⚠️ Toggle failed"); }

      } else if(action === "edit"){

        try{

          const ref = doc(db, "delivered", id);

          const snap = await getDoc(ref);

          if(!snap.exists()) return showToast("Record missing");

          const data = snap.data();

          editingDeliveredId = id;

          editDeliveredTitle.textContent = "Edit Delivered";

          deliveredRequestSelect.value = data.fromRequestId || "";

          editDeliveredParticular.value = data.particular || "";

          editDeliveredUnit.value = data.unit || "";

          editDeliveredQty.value = data.qty || 1;

          openModal(editDeliveredModal);

        } catch(e){ console.error(e); showToast("⚠️ Fetch failed"); }

      }

    };

  });

});

// ---------- Remaining: compute and show ----------

viewRemainingBtn.addEventListener("click", ()=> { computeAndRenderRemaining(); openModal(remainingModal); });

closeRemainingBtn.addEventListener("click", ()=> closeModal(remainingModal));

async function computeAndRenderRemaining(){

  const reqSnap = await getDocs(requestsCol);

  const delSnap = await getDocs(deliveredCol);

  const usSnap = await getDocs(usageCol);

  const totals = {}; // key -> {particular, requested, delivered, used}

  reqSnap.forEach(s => {

    const d = s.data();

    const k = normKey(d.particular);

    totals[k] = totals[k] || { particular: d.particular, requested:0, delivered:0, used:0 };

    totals[k].requested += Number(d.qty || 0);

  });

  delSnap.forEach(s => {

    const d = s.data();

    const k = normKey(d.particular);

    totals[k] = totals[k] || { particular: d.particular, requested:0, delivered:0, used:0 };

    totals[k].delivered += Number(d.qty || 0);

  });

  usSnap.forEach(s => {

    const d = s.data();

    const k = normKey(d.particular);

    totals[k] = totals[k] || { particular: d.particular, requested:0, delivered:0, used:0 };

    totals[k].used += Number(d.qty || 0);

  });

  remainingTbody.innerHTML = "";

  const keys = Object.keys(totals).sort();

  if(keys.length === 0){ remainingTbody.innerHTML = `<tr><td colspan="5">No data</td></tr>`; return; }

  keys.forEach(k=>{

    const it = totals[k];

    const remaining = (it.delivered || 0) - (it.used || 0);

    const tr = document.createElement("tr");

    tr.innerHTML = `<td style="text-align:left;padding-left:10px">${escapeHtml(it.particular)}</td>

      <td>${it.requested || 0}</td><td>${it.delivered || 0}</td><td>${it.used || 0}</td><td>${remaining}</td>`;

    remainingTbody.appendChild(tr);

  });

}

// ---------- Usage: add/edit remarks ----------

viewUsageBtn.addEventListener("click", ()=> { renderUsage(); openModal(usageModal); });

closeUsageBtn.addEventListener("click", ()=> closeModal(usageModal));

addUsageBtn.addEventListener("click", ()=>{

  editingUsageId = null;

  editUsageTitle.textContent = "Add Usage";

  usageRequestSelect.value = "";

  editUsageParticular.value = ""; editUsageUnit.value = ""; editUsageQty.value = 1; editUsageRemarks.value = "";

  openModal(editUsageModal);

});

cancelEditUsageBtn.addEventListener("click", ()=> closeModal(editUsageModal));

saveUsageBtn.addEventListener("click", async ()=>{

  const particular = editUsageParticular.value.trim();

  const unit = editUsageUnit.value.trim();

  const qty = Number(editUsageQty.value);

  const remarks = editUsageRemarks.value.trim();

  const linkedRequestId = usageRequestSelect.value || null;

  if(!particular || !unit || !qty || qty <= 0){ showToast("⚠️ Fill usage fields"); return; }

  try{

    if(editingUsageId){

      await updateDoc(doc(db, "usage", editingUsageId), { particular, unit, qty, remarks, updatedAt: serverTimestamp() });

      showToast("✅ Usage updated");

    } else {

      await addDoc(usageCol, { particular, unit, qty, remarks, usedAt: serverTimestamp(), fromRequestId: linkedRequestId });

      showToast("✅ Usage added");

    }

    closeModal(editUsageModal);

  } catch(e){ console.error(e); showToast("⚠️ Save failed"); }

});

// render usage list with Edit Remarks action

function renderUsage(){

  const q = query(usageCol, orderBy("usedAt","desc"));

  onSnapshot(q, snapshot=>{

    usageTbody.innerHTML = "";

    snapshot.forEach(docSnap=>{

      const d = docSnap.data(); const id = docSnap.id;

      const date = fmtDate(d.usedAt);

      const tr = document.createElement("tr");

      tr.innerHTML = `<td style="text-align:left;padding-left:10px">${escapeHtml(d.particular)}</td>

        <td>${escapeHtml(d.unit)}</td><td>${d.qty}</td><td>${date}</td><td>${escapeHtml(d.remarks || "")}</td>

        <td><button class="table-btn small-edit" data-id="${id}" data-action="edit">Edit Remarks</button></td>`;

      usageTbody.appendChild(tr);

    });

    usageTbody.querySelectorAll("button[data-action='edit']").forEach(btn=>{

      btn.onclick = async () => {

        const id = btn.dataset.id;

        try{

          const snap = await getDoc(doc(db,"usage",id));

          if(!snap.exists()) return showToast("Record missing");

          const data = snap.data();

          editingUsageId = id;

          editUsageTitle.textContent = "Edit Usage Remarks";

          usageRequestSelect.value = data.fromRequestId || "";

          editUsageParticular.value = data.particular || "";

          editUsageUnit.value = data.unit || "";

          editUsageQty.value = data.qty || 1;

          editUsageRemarks.value = data.remarks || "";

          openModal(editUsageModal);

        } catch(e){ console.error(e); showToast("⚠️ Fetch failed"); }

      };

    });

  });

}

// ---------- History (monthly totals) ----------

viewHistoryBtn.addEventListener("click", async ()=> { await renderHistory(); openModal(historyModal); });

closeHistoryBtn.addEventListener("click", ()=> closeModal(historyModal));

async function renderHistory(){

  const snaps = await getDocs(usageCol);

  const totals = {};

  snaps.forEach(s=>{

    const d = s.data();

    const dt = d.usedAt?.toDate ? d.usedAt.toDate() : (d.usedAt ? new Date(d.usedAt) : new Date());

    const month = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;

    const key = `${d.particular}||${month}`;

    totals[key] = (totals[key]||0) + Number(d.qty || 0);

  });

  historyTbody.innerHTML = "";

  const keys = Object.keys(totals).sort();

  if(keys.length === 0){ historyTbody.innerHTML = `<tr><td colspan="3">No history</td></tr>`; return; }

  keys.forEach(k=>{

    const [particular, month] = k.split("||");

    const [y,m] = month.split("-");

    const monthLabel = new Date(Number(y), Number(m)-1, 1).toLocaleString(undefined,{month:"long", year:"numeric"});

    const tr = document.createElement("tr");

    tr.innerHTML = `<td style="text-align:left;padding-left:10px">${escapeHtml(particular)}</td><td>${monthLabel}</td><td>${totals[k]}</td>`;

    historyTbody.appendChild(tr);

  });

}

// ---------- Helpers to populate request selects ----------
async function fillRequestSelects(requests){
  deliveredRequestSelect.innerHTML = `<option value="">-- Select a submitted request --</option>`;
  usageRequestSelect.innerHTML = `<option value="">-- Select a submitted request --</option>`;

  requests.sort((a,b) => {
    const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return tb - ta;
  });

  requests.forEach(r=>{
    const label = `${r.personnel} — ${r.particular} (${r.qty})`;
    const opt = document.createElement("option"); opt.value = r.id; opt.textContent = label;
    const opt2 = opt.cloneNode(true);
    deliveredRequestSelect.appendChild(opt);
    usageRequestSelect.appendChild(opt2);
  });

  deliveredRequestSelect.onchange = () => {
    const rid = deliveredRequestSelect.value;
    const sel = requests.find(x=> x.id === rid);
    if(sel){ editDeliveredParticular.value = sel.particular; editDeliveredUnit.value = sel.unit; editDeliveredQty.value = sel.qty; }
    else { editDeliveredParticular.value=""; editDeliveredUnit.value=""; editDeliveredQty.value=1; }
  };
  usageRequestSelect.onchange = () => {
    const rid = usageRequestSelect.value;
    const sel = requests.find(x=> x.id === rid);
    if(sel){ editUsageParticular.value = sel.particular; editUsageUnit.value = sel.unit; editUsageQty.value = sel.qty; }
    else { editUsageParticular.value=""; editUsageUnit.value=""; editUsageQty.value=1; }
  };
}

// ---------- Boot: initial fill of selects ----------
(async function boot(){
  const reqSnap = await getDocs(requestsCol);
  const arr = [];
  reqSnap.forEach(s=> arr.push({ id: s.id, personnel: s.data().personnel, particular: s.data().particular, unit: s.data().unit, qty: s.data().qty, createdAt: s.data().createdAt }));
  fillRequestSelects(arr);
})();

// === CONTINUATION (additional convenience load functions) ===
// These functions provide simple single-shot loads for delivered/usage/remaining/history tables
// (helpful when you want to ensure full lists are present on a manual refresh)
async function loadDeliveredRecords() {
  // Build the same structure used by delivered listener but as a one-time load (for external UI if needed)
  const tbody = deliveredTbody;
  tbody.innerHTML = "";
  const snap = await getDocs(deliveredCol);
  snap.forEach(docSnap=>{
    const d = docSnap.data();
    const date = fmtDate(d.deliveredAt);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td style="text-align:left;padding-left:10px">${escapeHtml(d.particular)}</td>
      <td>${escapeHtml(d.unit)}</td><td>${d.qty}</td><td>${escapeHtml(d.status||"pending")}</td><td>${date}</td>
      <td></td>`;
    tbody.appendChild(tr);
  });
}
async function loadUsageRecords() {
  const tbody = usageTbody;
  tbody.innerHTML = "";
  const snap = await getDocs(usageCol);
  snap.forEach(docSnap=>{
    const d = docSnap.data();
    const date = fmtDate(d.usedAt);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td style="text-align:left;padding-left:10px">${escapeHtml(d.particular)}</td>
      <td>${escapeHtml(d.unit)}</td><td>${d.qty}</td><td>${date}</td><td>${escapeHtml(d.remarks||"")}</td><td></td>`;
    tbody.appendChild(tr);
  });
}
async function loadRemainingRecords() {
  // reuse computeAndRenderRemaining
  await computeAndRenderRemaining();
}
async function loadMaterialHistory() {
  // reuse renderHistory's logic but populate history table directly
  await renderHistory();
}

// === INITIAL LOAD ===
window.addEventListener("load", () => {
  // listeners already populate via onSnapshot; call helper loads to ensure UI has something initially
  loadDeliveredRecords();
  loadUsageRecords();
  loadRemainingRecords();
  loadMaterialHistory();
});