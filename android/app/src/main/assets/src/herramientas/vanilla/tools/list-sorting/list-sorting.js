class ListSortingTool {
  constructor() {
    this.animals = [
      { name: 'HORMIGA', size: 1, category: 'animal' },
      { name: 'CARACOL', size: 2, category: 'animal' },
      { name: 'RANA', size: 3, category: 'animal' },
      { name: 'RATÓN', size: 4, category: 'animal' },
      { name: 'PALOMA', size: 5, category: 'animal' },
      { name: 'CONEJO', size: 6, category: 'animal' },
      { name: 'GATO', size: 7, category: 'animal' },
      { name: 'ZORRO', size: 8, category: 'animal' },
      { name: 'PERRO', size: 9, category: 'animal' },
      { name: 'ÁGUILA', size: 10, category: 'animal' },
      { name: 'LOBO', size: 11, category: 'animal' },
      { name: 'CERDO', size: 12, category: 'animal' },
      { name: 'OVEJA', size: 13, category: 'animal' },
      { name: 'CIERVO', size: 14, category: 'animal' },
      { name: 'LEÓN', size: 15, category: 'animal' },
      { name: 'CABALLO', size: 16, category: 'animal' },
      { name: 'VACA', size: 17, category: 'animal' },
      { name: 'OSO', size: 18, category: 'animal' },
      { name: 'JIRAFA', size: 19, category: 'animal' },
      { name: 'ELEFANTE', size: 20, category: 'animal' }
    ];
    this.foods = [
      { name: 'GUISANTE', size: 1, category: 'food' },
      { name: 'UVA', size: 2, category: 'food' },
      { name: 'CEREZA', size: 3, category: 'food' },
      { name: 'FRESA', size: 4, category: 'food' },
      { name: 'NUEZ', size: 5, category: 'food' },
      { name: 'LIMÓN', size: 6, category: 'food' },
      { name: 'HUEVO', size: 7, category: 'food' },
      { name: 'KIWI', size: 8, category: 'food' },
      { name: 'NARANJA', size: 9, category: 'food' },
      { name: 'MANZANA', size: 10, category: 'food' },
      { name: 'PATATA', size: 11, category: 'food' },
      { name: 'MANGO', size: 12, category: 'food' },
      { name: 'PEPINO', size: 13, category: 'food' },
      { name: 'BERENJENA', size: 14, category: 'food' },
      { name: 'PIÑA', size: 15, category: 'food' },
      { name: 'LECHUGA', size: 16, category: 'food' },
      { name: 'MELÓN', size: 17, category: 'food' },
      { name: 'SANDÍA', size: 18, category: 'food' },
      { name: 'CALABAZA', size: 19, category: 'food' },
      { name: 'COL', size: 20, category: 'food' }
    ];
    this.level = 1;
    this.itemCount = 3;
    this.speed = 2000;
    this.isPlaying = false;
    this.phase = 'idle';
    this.currentItems = [];
    this.presentationOrder = [];
    this.correctOrder = [];
    this.displayedInOrder = false;
    this.presentIndex = 0;
    this.roundStart = 0;
    this.hits = 0;
    this.misses = 0;
    this.rounds = 0;
    this.rtSum = 0;
    this.rtCount = 0;
    this.timer = null;
    this.audioCtx = null;
  }

  getAudioCtx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    return this.audioCtx;
  }

  beep(freq, dur) {
    const ctx = this.getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.25;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000);
    osc.stop(ctx.currentTime + dur / 1000);
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    const btn = document.getElementById('btnPlayPause');
    if (this.isPlaying) {
      btn.classList.add('active');
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      ScreenWakeLock.request();
      this.startRound();
    } else {
      btn.classList.remove('active');
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      ScreenWakeLock.release();
      this.clearTimers();
    }
  }

  changeLevel(val) {
    this.level = parseInt(val, 10);
    if (this.isPlaying) {
      this.clearTimers();
      this.isPlaying = false;
      document.getElementById('btnPlayPause').classList.remove('active');
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
    }
    this.resetStats();
    this.showIdle();
  }

  changeCount(val) {
    this.itemCount = parseInt(val, 10);
  }

  changeSpeed(ms) {
    this.speed = parseInt(ms, 10);
  }

  clearTimers() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
    this.rounds = 0;
    this.rtSum = 0;
    this.rtCount = 0;
    this.updateStats();
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  pickItems() {
    if (this.level === 1) {
      const pool = Math.random() < 0.5 ? [...this.animals] : [...this.foods];
      return this.shuffle(pool).slice(0, this.itemCount);
    }
    const animalCount = Math.max(1, Math.floor(this.itemCount / 2));
    const foodCount = this.itemCount - animalCount;
    const picked = [
      ...this.shuffle([...this.animals]).slice(0, animalCount),
      ...this.shuffle([...this.foods]).slice(0, foodCount)
    ];
    return this.shuffle(picked);
  }

  getCorrectOrder(items) {
    if (this.level === 1) {
      return [...items].sort((a, b) => a.size - b.size);
    }
    const foods = items.filter(i => i.category === 'food').sort((a, b) =>
      this.level === 3 ? b.size - a.size : a.size - b.size
    );
    const animals = items.filter(i => i.category === 'animal').sort((a, b) =>
      this.level === 3 ? b.size - a.size : a.size - b.size
    );
    return [...foods, ...animals];
  }

  isInCorrectOrder(order) {
    for (let i = 0; i < order.length; i++) {
      if (order[i].name !== this.correctOrder[i].name) return false;
    }
    return true;
  }

  showIdle() {
    this.phase = 'idle';
    this.hideAllPhases();
    document.getElementById('presentZone').style.display = '';
    document.getElementById('presentItem').style.display = 'none';
    document.getElementById('presentCat').style.display = 'none';
    document.getElementById('presentCounter').style.display = 'none';
    this.setInstruction('Memoriza los objetos');
    this.setBtnState(false);
  }

  hideAllPhases() {
    document.getElementById('presentZone').style.display = 'none';
    document.getElementById('questionPhase').style.display = 'none';
    document.getElementById('feedbackPhase').style.display = 'none';
    document.getElementById('feedbackIcon').style.display = 'none';
  }

  startRound() {
    if (!this.isPlaying) return;
    this.currentItems = this.pickItems();
    this.correctOrder = this.getCorrectOrder(this.currentItems);

    // 50% se presentan en orden correcto, 50% desordenados
    this.displayedInOrder = Math.random() < 0.5;

    if (this.displayedInOrder) {
      this.presentationOrder = [...this.correctOrder];
    } else {
      this.presentationOrder = [...this.currentItems];
      do {
        this.shuffle(this.presentationOrder);
      } while (this.isInCorrectOrder(this.presentationOrder));
    }

    this.presentIndex = 0;
    this.phase = 'presenting';

    this.setInstruction('Memoriza...');
    this.hideAllPhases();
    document.getElementById('presentZone').style.display = '';
    this.setBtnState(false);
    this.showPresentItem();
  }

  showPresentItem() {
    if (!this.isPlaying || this.phase !== 'presenting') return;

    const el = document.getElementById('presentItem');
    const catEl = document.getElementById('presentCat');
    const counterEl = document.getElementById('presentCounter');

    if (this.presentIndex < this.presentationOrder.length) {
      const item = this.presentationOrder[this.presentIndex];
      el.textContent = item.name;
      el.className = 'present-item cat-' + item.category + ' fade-in';
      catEl.textContent = item.category === 'animal' ? 'Animal' : 'Alimento';
      catEl.className = 'present-cat cat-' + item.category;
      counterEl.textContent = (this.presentIndex + 1) + ' / ' + this.presentationOrder.length;

      el.style.display = '';
      catEl.style.display = '';
      counterEl.style.display = '';

      this.beep(600, 60);
      if (navigator.vibrate) navigator.vibrate(30);

      this.presentIndex++;
      this.timer = setTimeout(() => {
        el.classList.remove('fade-in');
        this.timer = setTimeout(() => this.showPresentItem(), 200);
      }, this.speed - 200);
    } else {
      this.hideAllPhases();
      this.showBlank();
    }
  }

  showBlank() {
    if (!this.isPlaying) return;
    this.phase = 'blank';
    this.hideAllPhases();
    this.setInstruction('¡Recuerda!');
    this.timer = setTimeout(() => this.showQuestion(), 1000);
  }

  showQuestion() {
    if (!this.isPlaying) return;
    this.phase = 'decide';

    this.hideAllPhases();
    document.getElementById('questionPhase').style.display = '';

    const questionTexts = {
      1: '¿Estaban de menor a mayor tamaño?',
      2: '¿Alimentos primero, animales después? (menor a mayor)',
      3: '¿Alimentos primero, animales después? (mayor a menor)'
    };
    this.setInstruction(questionTexts[this.level]);

    this.setBtnState(true);
    this.roundStart = performance.now();
  }

  handleAnswer(answer) {
    if (this.phase !== 'decide') return;
    this.phase = 'feedback';
    this.setBtnState(false);

    const rt = performance.now() - this.roundStart;
    const correct = (answer === 'true') === this.displayedInOrder;

    this.rounds++;
    if (correct) {
      this.hits++;
      this.rtSum += rt;
      this.rtCount++;
    } else {
      this.misses++;
    }

    this.showFeedback(correct);
    this.updateStats();

    this.timer = setTimeout(() => this.startRound(), correct ? 1200 : 2500);
  }

  showFeedback(correct) {
    const icon = document.getElementById('feedbackIcon');
    icon.style.display = '';
    document.getElementById('questionPhase').style.display = 'none';

    if (correct) {
      icon.textContent = 'check_circle';
      icon.style.color = '#10b981';
      document.getElementById('feedbackPhase').style.display = 'none';
    } else {
      icon.textContent = 'cancel';
      icon.style.color = 'var(--rosa-400)';
      this.showCorrectOrder();
    }
    if (navigator.vibrate) {
      navigator.vibrate(correct ? 30 : [50, 50, 50]);
    }
    this.beep(correct ? 800 : 300, 120);
  }

  showCorrectOrder() {
    this.setInstruction('Orden correcto:');
    document.getElementById('feedbackPhase').style.display = '';
    const container = document.getElementById('correctItems');
    container.innerHTML = '';
    this.correctOrder.forEach((item, i) => {
      if (i > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'correct-arrow material-symbols-sharp';
        arrow.textContent = 'arrow_forward';
        container.appendChild(arrow);
      }
      const span = document.createElement('span');
      span.className = 'correct-name cat-' + item.category;
      span.textContent = item.name;
      container.appendChild(span);
    });
  }

  setBtnState(enabled) {
    document.getElementById('btnTrue').disabled = !enabled;
    document.getElementById('btnFalse').disabled = !enabled;
    document.getElementById('answerBtns').style.display = enabled ? '' : 'none';
  }

  setInstruction(text) {
    document.getElementById('instruction').textContent = text;
  }

  updateStats() {
    document.getElementById('statHits').textContent = this.hits;
    document.getElementById('statMisses').textContent = this.misses;
    document.getElementById('statTotal').textContent = this.rounds;
    const avgRt = this.rtCount > 0 ? Math.round(this.rtSum / this.rtCount) : '--';
    document.getElementById('statRT').textContent = avgRt === '--' ? '--' : avgRt + 'ms';
  }
}

const tool = new ListSortingTool();
