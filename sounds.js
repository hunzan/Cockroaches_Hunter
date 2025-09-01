// /sounds.js
window.SOUNDS = {
  bgm: {
    index: 'assets/sounds/start_theme.mp3',
    tutorial: 'assets/sounds/tutorial_theme.mp3',
    game: {
      1: 'assets/sounds/game_01.mp3',
      2: 'assets/sounds/game_02.mp3',
      3: 'assets/sounds/game_03.mp3',
      4: 'assets/sounds/game_04.mp3',
      5: 'assets/sounds/game_05.mp3',
    }
  },
  sfx: {
    fire:    'assets/sounds/firegun.mp3',
    spray:   'assets/sounds/spray.mp3',
    slipper: 'assets/sounds/slipper.mp3',
    miss:    'assets/sounds/miss.mp3',
    fly:     'assets/sounds/cockroach_fly.mp3' // 檔名有沒有拼成 cockRoach? 檢一下
  },
  bugIntro: id => `assets/sounds/${id}_intro.mp3`,
  bugHit:   id => `assets/sounds/${id}_hit.mp3`,
};
