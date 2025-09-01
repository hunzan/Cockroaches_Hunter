// 儲存玩家資訊並導向開場畫面

document.getElementById("playerForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("playerName").value.trim();
  const hunterRadio = document.querySelector('input[name="hunter"]:checked');
  const avatar = hunterRadio ? hunterRadio.value : "hunter_a.png"; // 預設 A

  if (!name) {
    document.getElementById("status").textContent = "請輸入你的暱稱！";
    return;
  }

    const player = {
      name: name,
      avatar: `assets/images/hunters/${avatar}`,
      hp: 10,               // ✅ 初始血量
      coins: 10,            // ✅ 初始金幣
      recallVotes: 0,       // ✅ 初始罷免票
      weapon: "fire",
      weaponUsage: {
        fire: 10,           // ✅ 噴火槍
        spray: 10,          // ✅ 香氛噴霧
        slipper: 10,        // ✅ 藍白拖
        bait: 5,            // ✅ 預設餌劑
        cat: 0,             // ✅ UI 需要，非消耗型
        vote: 0,            // ✅ 預留
        recall: 0           // ✅ 預留（彈藥型兼容）
      }
    };

  // 儲存到 localStorage（跨頁可存取）
  localStorage.setItem("bugSlayerPlayer", JSON.stringify(player));

  // 導向開場畫面
  window.location.href = "intro.html";
});
