class MemoriaTool {
  constructor() {
    this.levels = {
      easy:   { pairs: 3, cols: 3, rows: 2, iconSize: '3.5rem' },
      medium: { pairs: 6, cols: 4, rows: 3, iconSize: '2.8rem' },
      hard:   { pairs: 10, cols: 5, rows: 4, iconSize: '2.2rem' }
    };
    this.allIcons = [
      { icon: 'favorite', color: '#e11d48' },
      { icon: 'home', color: '#3b82f6' },
      { icon: 'star', color: '#eab308' },
      { icon: 'pets', color: '#10b981' },
      { icon: 'local_cafe', color: '#8b5cf6' },
      { icon: 'restaurant', color: '#f97316' },
      { icon: 'directions_car', color: '#06b6d4' },
      { icon: 'flight', color: '#64748b' },
      { icon: 'beach_access', color: '#eab308' },
      { icon: 'sports_soccer', color: '#10b981' },
      { icon: 'music_note', color: '#e11d48' },
      { icon: 'phone', color: '#3b82f6' },
      { icon: 'mail', color: '#f97316' },
      { icon: 'cake', color: '#ec4899' },
      { icon: 'shopping_cart', color: '#8b5cf6' },
      { icon: 'wb_sunny', color: '#eab308' },
      { icon: 'cloud', color: '#94a3b8' },
      { icon: 'local_florist', color: '#10b981' },
      { icon: 'emoji_objects', color: '#eab308' },
      { icon: 'anchor', color: '#06b6d4' }
    ];
    this.currentLevel = 'easy';
    this.cards = [];
    this.flipped = [];
    this.matched = 0;
    this.attempts = 0;
    this.totalPairs = 0;
    this.timer = null;
    this.startTime = 0;
    this.elapsed = 0;
    this.locked = false;
    this.gameStarted = false;
  }

  changeLevel(level) {
    this.currentLevel = level;
    this.reset();
  }

  reset() {
    clearInterval(this.timer);
    this.timer = null;
    this.elapsed = 0;
    this.attempts = 0;
    this.matched = 0;
    this.flipped = [];
    this.locked = false;
    this.gameStarted = false;
    ScreenWakeLock.release();
    this.updateStats();
    document.getElementById('memoriaModal').style.display = 'none';
    this.buildBoard();
  }

  start() {
    this.reset();
    this.gameStarted = true;
    ScreenWakeLock.request();
    this.startTime = performance.now();
    this.timer = setInterval(() => {
      this.elapsed = Math.floor((performance.now() - this.startTime) / 1000);
      this.updateStats();
    }, 1000);
  }

  buildBoard() {
    const config = this.levels[this.currentLevel];
    this.totalPairs = config.pairs;
    const grid = document.getElementById('memoriaGrid');
    grid.style.gridTemplateColumns = 'repeat(' + config.cols + ', 1fr)';

    const selected = this.shuffle(this.allIcons.slice()).slice(0, config.pairs);
    const deck = this.shuffle([...selected, ...selected].map((item, i) => ({
      id: i,
      icon: item.icon,
      color: item.color,
      isFlipped: false,
      isMatched: false
    })));

    this.cards = deck;
    grid.innerHTML = '';

    deck.forEach((card, idx) => {
      const el = document.createElement('div');
      el.className = 'memoria-card';
      el.id = 'mcard-' + idx;
      el.onclick = () => this.flipCard(idx);
      el.innerHTML =
        '<div class="card-inner">' +
          '<div class="card-front">' +
            '<span class="material-symbols-sharp" style="font-size: 2rem; color: var(--gris-500);">help_outline</span>' +
          '</div>' +
          '<div class="card-back">' +
            '<span class="material-symbols-sharp" style="font-size: ' + config.iconSize + '; color: ' + card.color + ';">' + card.icon + '</span>' +
          '</div>' +
        '</div>';
      grid.appendChild(el);
    });
  }

  flipCard(idx) {
    if (!this.gameStarted || this.locked) return;
    const card = this.cards[idx];
    if (card.isFlipped || card.isMatched) return;
    if (this.flipped.length >= 2) return;

    card.isFlipped = true;
    this.flipped.push(idx);
    document.getElementById('mcard-' + idx).classList.add('flipped');

    if (this.flipped.length === 2) {
      this.attempts++;
      this.locked = true;
      this.checkMatch();
    }
  }

  checkMatch() {
    const [a, b] = this.flipped;
    const cardA = this.cards[a];
    const cardB = this.cards[b];

    if (cardA.icon === cardB.icon) {
      cardA.isMatched = true;
      cardB.isMatched = true;
      this.matched++;

      setTimeout(() => {
        document.getElementById('mcard-' + a).classList.add('matched');
        document.getElementById('mcard-' + b).classList.add('matched');
        this.flipped = [];
        this.locked = false;
        this.updateStats();

        if (this.matched === this.totalPairs) {
          this.gameWon();
        }
      }, 400);
    } else {
      setTimeout(() => {
        cardA.isFlipped = false;
        cardB.isFlipped = false;
        document.getElementById('mcard-' + a).classList.remove('flipped');
        document.getElementById('mcard-' + b).classList.remove('flipped');
        this.flipped = [];
        this.locked = false;
        this.updateStats();
      }, 900);
    }
  }

  gameWon() {
    clearInterval(this.timer);
    this.gameStarted = false;
    ScreenWakeLock.release();
    const modal = document.getElementById('memoriaModal');
    document.getElementById('modalAttempts').textContent = this.attempts;
    document.getElementById('modalTime').textContent = this.formatTime(this.elapsed);
    modal.style.display = 'flex';
  }

  formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  updateStats() {
    document.getElementById('statTime').textContent = this.formatTime(this.elapsed);
    document.getElementById('statAttempts').textContent = this.attempts;
    document.getElementById('statPairs').textContent = this.matched + '/' + this.totalPairs;
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

const tool = new MemoriaTool();
document.addEventListener('DOMContentLoaded', () => tool.buildBoard());
