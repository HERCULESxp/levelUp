(() => {
  "use strict";
  const KEY = "levelup-v1-data";
  const $ = (id) => document.getElementById(id);
  const today = () => localDate(new Date());
  const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const dateFromKey = (s) => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
  const shiftDate = (key, n) => { const d=dateFromKey(key); d.setDate(d.getDate()+n); return localDate(d); };
  const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
  const defaultState = () => ({
    version:1, settings:{dailyGoal:50,reminderTime:"20:30"},
    tasks:[
      {id:uid(),title:"Planejar as 3 prioridades do dia",category:"Organização",xp:10,repeat:"daily",due:"",created:today(),doneDates:[]},
      {id:uid(),title:"Trabalhar em um projeto por 30 minutos",category:"Trabalho",xp:25,repeat:"weekdays",due:"",created:today(),doneDates:[]},
      {id:uid(),title:"Organizar as tarefas de amanhã",category:"Organização",xp:10,repeat:"daily",due:"",created:today(),doneDates:[]}
    ], projects:[], xpEvents:[], daily:{}, streak:0,bestStreak:0,lastStreakDate:null,achievements:[],lastReminderDate:null
  });
  let state = loadState();
  let currentScreen = "home";
  let taskFilter = "all";
  let deferredInstallPrompt = null;
  let toastTimer = null;

  function loadState(){
    try { const saved=localStorage.getItem(KEY); if(saved){const parsed=JSON.parse(saved); if(parsed && parsed.version===1) return {...defaultState(),...parsed,settings:{...defaultState().settings,...parsed.settings}};} } catch(e){console.warn("Falha ao carregar dados",e);}
    return defaultState();
  }
  function save(){ try { localStorage.setItem(KEY,JSON.stringify(state)); } catch(e){ showToast("Não foi possível salvar os dados neste navegador."); } }
  function xpToday(){ return state.daily[today()]?.xp || 0; }
  function levelFor(xp){ return Math.floor(Math.sqrt(Math.max(0,xp)/100))+1; }
  function xpToNext(xp){ const lvl=levelFor(xp); return {level:lvl, current:xp-100*(lvl-1)*(lvl-1), needed:100*(lvl*lvl)-100*(lvl-1)*(lvl-1)}; }
  function totalXp(){ return state.xpEvents.reduce((sum,e)=>sum+e.xp,0); }
  function completedCount(){ return state.xpEvents.filter(e=>e.type==="task").length; }
  function isDone(task,date=today()){ return (task.doneDates||[]).includes(date); }
  function taskAvailable(task){
    if(task.repeat==="daily" || task.repeat==="weekdays") {
      if(task.repeat==="weekdays" && [0,6].includes(dateFromKey(today()).getDay())) return false;
      return !isDone(task);
    }
    return !isDone(task);
  }
  function taskIsOverdue(task){return task.due && task.due<today() && !isDone(task);}
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function showToast(message){const t=$("toast");t.textContent=message;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2600);}
  function showNotice(title,text){$("noticeTitle").textContent=title;$("noticeText").textContent=text;$("noticeDialog").showModal();}
  function nav(screen){currentScreen=screen;document.querySelectorAll(".screen").forEach(el=>el.classList.toggle("active",el.id===screen+"Screen"));document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.nav===screen));if(screen==="settings"){$("settingsBtn").classList.add("hidden");}else{$("settingsBtn").classList.remove("hidden");}render();window.scrollTo({top:0,behavior:"smooth"});}
  function taskCard(task,completed=false){
    const done=completed||isDone(task), overdue=taskIsOverdue(task);
    return `<article class="task-card ${done?"completed":""}" data-task-card="${task.id}">
      <button class="task-check" data-complete="${task.id}" aria-label="${done?"Concluída":"Concluir missão"}" ${done?"disabled":""}>${done?"✓":""}</button>
      <div class="task-content"><div class="task-title">${escapeHTML(task.title)}</div><div class="task-meta"><span class="category-tag">${escapeHTML(task.category)}</span><span class="xp-tag">＋${task.xp} XP</span>${task.repeat!=="once"?`<span class="category-tag">↻ ${task.repeat==="daily"?"Diária":"Dias úteis"}</span>`:""}${overdue?'<span class="category-tag" style="color:var(--red)">Atrasada</span>':""}</div></div>
      <div class="task-actions">${!done?`<button class="mini-action" data-edit-task="${task.id}" aria-label="Editar">✎</button>`:""}<button class="mini-action" data-delete-task="${task.id}" aria-label="Excluir">×</button></div>
    </article>`;
  }
  function renderTasks(){
    const active=state.tasks.filter(t=>taskAvailable(t));
    const completed=state.tasks.filter(t=>isDone(t));
    const filtered=active.filter(t=>taskFilter==="all"||t.category===taskFilter);
    $("homeTasks").innerHTML=active.slice(0,4).map(t=>taskCard(t)).join("");
    $("emptyHome").classList.toggle("hidden",active.length>0);
    $("allTasks").innerHTML=filtered.map(t=>taskCard(t)).join("");
    $("emptyTasks").classList.toggle("hidden",filtered.length>0);
    $("completedTasks").innerHTML=completed.length?completed.map(t=>taskCard(t,true)).join(""):'<p class="muted small">Ainda não há missões concluídas hoje.</p>';
  }
  function renderStreak(){
    const goal=state.settings.dailyGoal||50;
    const last=state.lastStreakDate;
    const current=state.streak||0;
    $("streakCount").textContent=current;
    $("bestStreak").innerHTML=`${state.bestStreak||0} <small>dias</small>`;
    const done=xpToday()>=goal;
    $("streakStatus").textContent=done?"DIA CONCLUÍDO":"EM JOGO";
    $("streakHint").textContent=done?"Meta concluída. Amanhã tem mais!":current>0?`Mais ${Math.max(0,goal-xpToday())} XP para manter a sequência.`:"Conclua sua meta de hoje para começar.";
    const names=["D","S","T","Q","Q","S","S"], todayDate=dateFromKey(today()), day=todayDate.getDay();
    const mondayIndex=(day+6)%7;
    let html="";
    for(let i=0;i<7;i++){
      const offset=i-mondayIndex, key=shiftDate(today(),offset), valid=(state.daily[key]?.xp||0)>=goal;
      html+=`<span class="day-dot ${valid?"done":key===today()?"today":""}" title="${key}">${valid?"✓":names[(i+1)%7]}</span>`;
    }
    $("weekDots").innerHTML=html;
    $("todayXp").textContent=xpToday();$("goalDisplay").textContent=goal;
    $("dailyProgress").style.width=Math.min(100,xpToday()/goal*100)+"%";
    $("dailyHint").textContent=done?"Meta diária atingida!":`Mais ${Math.max(0,goal-xpToday())} XP para manter seu streak.`;
    const level=levelFor(totalXp());$("levelNumber").textContent=level;
  }
  function renderProjects(){
    const list=$("projectsList");
    list.innerHTML=state.projects.map(p=>{
      const done=p.steps.filter(s=>s.done).length, percent=p.steps.length?Math.round(done/p.steps.length*100):0;
      return `<article class="project-card"><div class="project-head"><div><h3>${escapeHTML(p.title)}</h3><p class="small muted">${done} de ${p.steps.length} etapas concluídas</p></div><button class="mini-action" data-delete-project="${p.id}" aria-label="Excluir projeto">×</button></div><div class="project-progress"><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div></div><div class="project-steps">${p.steps.map(s=>`<button class="project-step ${s.done?"done":""}" data-project-step="${p.id}:${s.id}" ${s.done?"disabled":""}><span class="step-check">${s.done?"✓":""}</span><span>${escapeHTML(s.title)}</span><span class="xp-tag" style="margin-left:auto">+25 XP</span></button>`).join("")}</div></article>`;
    }).join("");
    $("emptyProjects").classList.toggle("hidden",state.projects.length>0);
  }
  function renderProgress(){
    const xp=totalXp(), lvl=xpToNext(xp);
    $("totalXp").textContent=xp;$("progressLevel").textContent=lvl.level;$("totalCompleted").textContent=completedCount();
    const days=[];for(let i=6;i>=0;i--){const key=shiftDate(today(),-i);days.push({key,xp:state.daily[key]?.xp||0,label:["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][dateFromKey(key).getDay()]});}
    const max=Math.max(50,...days.map(d=>d.xp));
    $("weeklyChart").innerHTML=days.map(d=>`<div class="chart-col"><span class="chart-value">${d.xp}</span><div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max(3,d.xp/max*100)}%;opacity:${d.xp?1:.25}"></div></div><span class="chart-day">${d.label}</span></div>`).join("");
    const achievements=[
      {icon:"🌱",title:"Primeiro passo",desc:"Conclua sua primeira missão.",ok:completedCount()>=1},
      {icon:"🔥",title:"Em sequência",desc:"Mantenha o streak por 3 dias.",ok:state.bestStreak>=3},
      {icon:"⚡",title:"Centenário",desc:"Acumule 100 XP no total.",ok:xp>=100},
      {icon:"🏆",title:"Consistência",desc:"Mantenha o streak por 7 dias.",ok:state.bestStreak>=7},
      {icon:"🚀",title:"Mão na massa",desc:"Conclua 25 missões.",ok:completedCount()>=25}
    ];
    $("achievementList").innerHTML=achievements.map(a=>`<div class="achievement ${a.ok?"":"locked"}"><span class="achievement-badge">${a.icon}</span><div><strong>${a.title}</strong><p>${a.desc}</p></div><span style="margin-left:auto">${a.ok?"✓":"🔒"}</span></div>`).join("");
  }
  function render(){
    const d=dateFromKey(today());
    $("dateLabel").textContent=d.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
    renderStreak();renderTasks();renderProjects();renderProgress();
  }
  function award(xp,source,id,title){
    const key=today();if(!state.daily[key])state.daily[key]={xp:0};
    state.daily[key].xp+=xp;state.xpEvents.push({id:uid(),date:key,xp,type:source,sourceId:id,title});
    updateStreak();save();
  }
  function updateStreak(){
    const goal=state.settings.dailyGoal||50,key=today(),met=(state.daily[key]?.xp||0)>=goal;
    if(!met)return;
    if(state.lastStreakDate===key)return;
    const yesterday=shiftDate(key,-1);
    state.streak=state.lastStreakDate===yesterday?(state.streak||0)+1:1;
    state.lastStreakDate=key;state.bestStreak=Math.max(state.bestStreak||0,state.streak);
    showToast(`🔥 Meta diária concluída! Streak: ${state.streak} ${state.streak===1?"dia":"dias"}.`);
  }
  function completeTask(id){
    const t=state.tasks.find(t=>t.id===id);if(!t||isDone(t))return;
    t.doneDates=t.doneDates||[];t.doneDates.push(today());award(t.xp,"task",t.id,t.title);render();
    if(xpToday()>=(state.settings.dailyGoal||50))showToast("Missão concluída e meta diária atingida! 🎉");else showToast(`+${t.xp} XP — missão concluída!`);
  }
  function openTask(id=null){
    $("taskForm").reset();$("taskId").value="";
    $("taskModalTitle").textContent=id?"Editar missão":"Criar missão";
    $("taskDifficulty").value="25";$("taskRepeat").value="once";$("taskDue").value="";
    if(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;$("taskId").value=id;$("taskTitle").value=t.title;$("taskCategory").value=t.category;$("taskDifficulty").value=String(t.xp);$("taskRepeat").value=t.repeat;$("taskDue").value=t.due||"";}
    $("taskDialog").showModal();
  }
  function saveTaskFromForm(e){
    e.preventDefault();const id=$("taskId").value,title=$("taskTitle").value.trim();if(!title)return;
    const data={title,category:$("taskCategory").value,xp:Number($("taskDifficulty").value),repeat:$("taskRepeat").value,due:$("taskDue").value};
    if(id){const t=state.tasks.find(x=>x.id===id);if(t)Object.assign(t,data);}
    else state.tasks.push({id:uid(),...data,created:today(),doneDates:[]});
    save();$("taskDialog").close();render();showToast(id?"Missão atualizada.":"Missão criada!");
  }
  function deleteTask(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;if(!confirm(`Excluir a missão "${t.title}"?`))return;state.tasks=state.tasks.filter(x=>x.id!==id);save();render();showToast("Missão excluída.");}
  function createProject(e){
    e.preventDefault();const title=$("projectTitle").value.trim();if(!title)return;
    const lines=$("projectSteps").value.split("\n").map(s=>s.trim()).filter(Boolean);
    if(!lines.length){showNotice("Adicione etapas","Escreva pelo menos uma etapa, cada uma em uma linha.");return;}
    const project={id:uid(),title,created:today(),steps:lines.map(title=>({id:uid(),title,done:false}))};
    state.projects.push(project);
    project.steps.forEach(s=>state.tasks.push({id:uid(),title:s.title,category:"Trabalho",xp:25,repeat:"once",due:"",created:today(),doneDates:[],projectId:project.id,projectStepId:s.id}));
    save();$("projectDialog").close();$("projectForm").reset();render();showToast("Projeto criado com missões para cada etapa.");
  }
  function completeProjectStep(projectId,stepId){
    const p=state.projects.find(x=>x.id===projectId),s=p?.steps.find(x=>x.id===stepId);if(!s||s.done)return;
    s.done=true;
    const task=state.tasks.find(t=>t.projectId===projectId&&t.projectStepId===stepId);
    if(task&&!isDone(task)){task.doneDates.push(today());award(task.xp,"task",task.id,task.title);}
    save();render();showToast("Etapa concluída! +25 XP");
  }
  function deleteProject(id){const p=state.projects.find(x=>x.id===id);if(!p||!confirm(`Excluir o projeto "${p.title}" e suas missões?`))return;state.projects=state.projects.filter(x=>x.id!==id);state.tasks=state.tasks.filter(t=>t.projectId!==id);save();render();showToast("Projeto excluído.");}
  function exportBackup(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=`levelup-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);showToast("Backup exportado.");
  }
  function importBackup(file){
    if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result);if(parsed.version!==1||!Array.isArray(parsed.tasks)||!Array.isArray(parsed.projects))throw new Error("Formato inválido");if(!confirm("Importar este backup substituirá os dados atuais. Continuar?"))return;state=parsed;save();render();showToast("Backup importado com sucesso.");}catch(e){showNotice("Backup inválido","Não foi possível importar esse arquivo. Use um backup exportado pelo LevelUp.");}};reader.readAsText(file);
  }
  function checkReminder(){
    const now=new Date(),key=today(),time=state.settings.reminderTime||"20:30",parts=time.split(":").map(Number);
    if(now.getHours()===parts[0]&&now.getMinutes()===parts[1]&&state.lastReminderDate!==key&&xpToday()<(state.settings.dailyGoal||50)){
      state.lastReminderDate=key;save();showNotice("Sua sequência está em jogo 🔥",`Você tem ${Math.max(0,state.settings.dailyGoal-xpToday())} XP para alcançar a meta de hoje. Faça uma missão pequena e mantenha o ritmo.`);
      if("Notification" in window && Notification.permission==="granted")new Notification("LevelUp — sua sequência está em jogo",{body:`Faltam ${Math.max(0,state.settings.dailyGoal-xpToday())} XP para sua meta de hoje.`});
    }
  }
  document.addEventListener("click",e=>{
    const navBtn=e.target.closest("[data-nav]");if(navBtn){nav(navBtn.dataset.nav);return;}
    const complete=e.target.closest("[data-complete]");if(complete){completeTask(complete.dataset.complete);return;}
    const edit=e.target.closest("[data-edit-task]");if(edit){openTask(edit.dataset.editTask);return;}
    const del=e.target.closest("[data-delete-task]");if(del){deleteTask(del.dataset.deleteTask);return;}
    const step=e.target.closest("[data-project-step]");if(step){const [p,s]=step.dataset.projectStep.split(":");completeProjectStep(p,s);return;}
    const dp=e.target.closest("[data-delete-project]");if(dp){deleteProject(dp.dataset.deleteProject);return;}
    const close=e.target.closest("[data-close]");if(close){$(close.dataset.close).close();return;}
    const action=e.target.closest("[data-action]");if(action){if(action.dataset.action==="new-task")openTask();if(action.dataset.action==="new-project")$("projectDialog").showModal();}
  });
  $("taskForm").addEventListener("submit",saveTaskFromForm);
  $("projectForm").addEventListener("submit",createProject);
  $("addTaskBtn").addEventListener("click",()=>openTask());
  $("quickAddBtn").addEventListener("click",()=>openTask());
  $("addProjectBtn").addEventListener("click",()=>$("projectDialog").showModal());
  $("settingsBtn").addEventListener("click",()=>{nav("settings");$("goalInput").value=state.settings.dailyGoal;$("reminderTime").value=state.settings.reminderTime;});
  $("saveSettingsBtn").addEventListener("click",()=>{
    const goal=Math.max(10,Math.min(500,Number($("goalInput").value)||50));state.settings.dailyGoal=goal;state.settings.reminderTime=$("reminderTime").value||"20:30";save();render();showToast("Configurações salvas.");
    if("Notification" in window && Notification.permission==="default" && confirm("Deseja permitir notificações para lembretes?"))Notification.requestPermission();
  });
  $("taskFilters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;taskFilter=b.dataset.filter;document.querySelectorAll(".filter-chip").forEach(x=>x.classList.toggle("selected",x===b));renderTasks();});
  $("exportBtn").addEventListener("click",exportBackup);
  $("importInput").addEventListener("change",e=>{importBackup(e.target.files[0]);e.target.value="";});
  $("resetBtn").addEventListener("click",()=>{if(confirm("Isso apagará tarefas, projetos, XP e streak deste aparelho. Esta ação não pode ser desfeita. Exporte um backup antes, se necessário. Continuar?")){state=defaultState();save();render();showToast("Dados reiniciados.");}});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("installBtn").classList.remove("hidden");});
  $("installBtn").addEventListener("click",async()=>{if(!deferredInstallPrompt){showNotice("Instalar LevelUp","No Chrome para Android, abra o menu ⋮ e selecione “Instalar app” ou “Adicionar à tela inicial”.");return;}deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$("installBtn").classList.add("hidden");});
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("Service worker não registrado",err));
  render();setInterval(checkReminder,30000);
})();