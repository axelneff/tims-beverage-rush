/* Order rules: real build steps, hint fade, mastery, and which drinks are on the menu. */
(function (root) {
  const RECIPES = root.TBR_RECIPES;
  if (!RECIPES || !RECIPES.length) throw new Error('Drink recipes did not load');

  const STATION = {
    'Dairy Fridge': 'dairy',
    'Lid Station (strawless / hot / dome)': 'lids',
    'Java Mix / Neutral Base Machine': 'javamix',
    'Whipper & Sanitizer Cup': 'blender',
    'Hand-off to Guest': 'counter',
    'Syrup Pumps': 'syrups',
    'Iced Coffee / Cold Brew Dispensers': 'icedcoffee',
    'Stir (spoon)': 'stir',
    'Ice Bin': 'ice',
    'Whipped Topping': 'topping',
    'Drizzle': 'drizzle',
    'Iced Tea / Lemonade Dispensers': 'lemonade',
    'Steam Wand & Dairy Pitcher': 'steam',
    'Espresso Machine': 'espresso',
    'Hot Coffee Brewer & Hot Water': 'brewer',
    'Scoops (matcha / dried fruit / OREO)': 'scoops',
    'Hot Chocolate / French Vanilla Dispenser': 'hc',
    'Refresher Dispenser': 'refresher',
    'Tea Bags': 'teabags',
    'Sugar': 'sugar',
    'Cup Sleeve': 'sleeve',
    'Red Bull Fridge': 'redbull'
  };

  const ICONS = {
    cups: '🥤',
    dairy: '🥛',
    syrups: '🍯',
    lids: '🧢',
    javamix: '🧃',
    blender: '🌀',
    sanitize: '💧',
    ice: '🧊',
    icedcoffee: '☕',
    stir: '🥄',
    topping: '🍦',
    drizzle: '✨',
    counter: '🤝',
    lemonade: '🍋',
    steam: '🥛',
    espresso: '☕',
    brewer: '☕',
    scoops: '🥄',
    hc: '🍫',
    refresher: '🍓',
    teabags: '🫖',
    sugar: '🍬',
    sleeve: '🥤',
    redbull: '🥫'
  };

  /* Stations that exist in the cafe right now. Later machines stay in the data only. */
  const READY = new Set([
    'cups', 'dairy', 'syrups', 'lids', 'javamix', 'blender', 'sanitize',
    'ice', 'icedcoffee', 'stir', 'topping', 'drizzle', 'counter', 'lemonade'
  ]);

  /* Suggested menu order. Drinks with uncertainty flags stay in the data and off the menu,
     except Double Double: the only flag is an unprinted dairy portion, and it is a starter. */
  const TIERS = [
    ['iced-capp', 'iced-coffee-double-double', 'caramel-iced-capp'],
    ['iced-lemonade', 'iced-tea', 'coffee', 'iced-coffee', 'cold-brew'],
    ['iced-coffee-triple-triple', 'iced-coffee-4-x-4', 'vanilla-iced-capp', 'iced-capp-light', 'vanilla-cream-cold-brew'],
    ['mocha-iced-capp', 'oreo-iced-capp', 'frozen-hot-chocolate'],
    ['refresher', 'refresher-with-coconut-milk-or-lemonade', 'ruby-rush-timsboost', 'tropical-sun-timsboost', 'unsweetened-iced-tea', 'sweetened-iced-tea', 'sweetened-iced-tea-low-volume-only', 'half-and-half-lemonade-iced-tea'],
    ['hot-chocolate', 'coffee-mocha', 'french-vanilla', 'chai-iced-latte', 'vanilla-chai-iced-latte', 'iced-matcha-latte'],
    ['iced-latte', 'americano', 'latte', 'cappuccino', 'iced-macchiato', 'macchiato', 'caramel-macchiato', 'iced-caramel-macchiato'],
    ['chai-latte', 'hot-matcha-latte', 'london-fog', 'tea-latte']
  ];

  const STARTER_OVERRIDE = new Set(['iced-coffee-double-double']);
  const STAGE_FLOOR = [0, 20, 40, 60, 80];
  const STAGE_LABEL = ['Build card', 'Glow', 'Icons', 'First step', 'Memory'];
  const REVIEW_LADDER = [3, 8, 20, 40];
  const ORDER_SECONDS = 35;

  const byId = {};
  RECIPES.forEach((drink) => { byId[drink.id] = drink; });

  function isPlayable(drink) {
    if (!drink) return false;
    if (STARTER_OVERRIDE.has(drink.id)) return true;
    return !drink.uncertain || drink.uncertain.length === 0;
  }

  function lidName(action, drinkLid) {
    const text = ((action || '') + ' ' + (drinkLid || '')).toLowerCase();
    if (text.indexOf('dome') !== -1) return 'Dome';
    if (text.indexOf('strawless') !== -1) return 'Strawless';
    if (text.indexOf('hot') !== -1) return 'Hot';
    return 'Dome';
  }

  function normalize(drink, raw, stationId) {
    const step = {
      stationId: stationId,
      kind: 'simple',
      action: raw.action,
      ingredient: raw.ingredient || '',
      icon: ICONS[stationId] || '•',
      hint: raw.action,
      accept: { simple: stationId }
    };
    if (stationId === 'lids') {
      const lid = lidName(raw.action, drink.lid);
      step.kind = 'lid';
      step.hint = lid + ' lid';
      step.accept = { lid: lid };
      return step;
    }
    if (stationId === 'syrups' && raw.amount && raw.amount.pumps) {
      step.kind = 'pumps';
      step.hint = (raw.ingredient || 'Syrup') + ' · ' + raw.amount.pumps + ' pumps';
      step.accept = { ingredient: raw.ingredient, pumps: raw.amount.pumps };
      return step;
    }
    if (raw.amount && (raw.amount.fill_line || raw.amount.fill)) {
      const fill = raw.amount.fill_line || raw.amount.fill;
      const ingredient = raw.ingredient || 'Fill';
      step.kind = 'fill';
      step.hint = fill === 'rim' ? (ingredient + ' to the rim') : (ingredient + ' · ' + fill + ' line');
      step.accept = { ingredient: ingredient, fill: fill };
      return step;
    }
    if (stationId === 'drizzle') {
      step.kind = 'drizzle';
      step.hint = raw.ingredient || raw.action;
      step.accept = { ingredient: raw.ingredient || '' };
      return step;
    }
    if (stationId === 'dairy') {
      const fill = raw.amount && raw.amount.fill_line ? raw.amount.fill_line : null;
      step.kind = 'dairy';
      if (!fill && /cold dairy|dairy alt/i.test(raw.ingredient || '')) {
        step.hint = 'Cold dairy or dairy alternative';
      } else if (fill) {
        step.hint = (raw.ingredient || 'Dairy') + ' · ' + fill + ' line';
      } else {
        step.hint = raw.ingredient || raw.action;
      }
      step.accept = { ingredient: raw.ingredient || 'Dairy', fill: fill };
      return step;
    }
    if (stationId === 'counter') {
      step.kind = 'simple';
      step.hint = raw.action;
      step.accept = { simple: 'serve' };
      return step;
    }
    if (raw.amount && typeof raw.amount.shots === 'number') {
      step.kind = 'shots';
      step.hint = raw.amount.shots + ' shots';
      step.accept = { shots: raw.amount.shots };
      return step;
    }
    return step;
  }

  function expandBuild(drink, size, opts) {
    opts = opts || {};
    const build = drink.builds.filter((b) => b.size === size)[0] || drink.builds[0];
    const steps = [{
      stationId: 'cups',
      kind: 'cup',
      action: 'Grab a ' + size + ' cup',
      hint: size + ' cup · ' + build.cup_oz + ' oz',
      icon: ICONS.cups,
      accept: { size: size },
      sizes: drink.sizes_available.slice(),
      oz: build.cup_oz
    }];
    build.steps.forEach((raw) => {
      if (raw.optional && !(opts.flavor && raw.station === 'Syrup Pumps')) return;
      const stationId = STATION[raw.station];
      if (!stationId) throw new Error('Unmapped station "' + raw.station + '" on ' + drink.id);
      if (raw.amount && raw.amount.sanitize_after) {
        steps.push({
          stationId: 'blender',
          kind: 'simple',
          action: 'Whip for 15 seconds',
          hint: 'Whip 15 seconds',
          icon: ICONS.blender,
          accept: { simple: 'whip' }
        });
        steps.push({
          stationId: 'sanitize',
          kind: 'simple',
          action: 'Rinse the whipper in the sanitizer cup',
          hint: 'Rinse the whipper',
          icon: ICONS.sanitize,
          accept: { simple: 'sanitize' }
        });
        return;
      }
      steps.push(normalize(drink, raw, stationId));
    });
    if (steps[steps.length - 1].stationId !== 'counter') {
      steps.push({
        stationId: 'counter',
        kind: 'simple',
        action: 'Hand the cup to the guest',
        hint: 'Hand off to the guest',
        icon: ICONS.counter,
        accept: { simple: 'serve' }
      });
    }
    return steps;
  }

  function exposable(drink) {
    if (!isPlayable(drink)) return false;
    try {
      drink.sizes_available.forEach((size) => {
        [false, true].forEach((flavor) => {
          const steps = expandBuild(drink, size, { flavor: flavor });
          steps.forEach((step) => {
            if (!READY.has(step.stationId)) {
              throw new Error('station ' + step.stationId);
            }
          });
        });
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  function tierExposable(tierIndex) {
    const ids = TIERS[tierIndex] || [];
    return ids.filter((id) => exposable(byId[id]));
  }

  function exposedIds(unlockedThrough) {
    const ids = [];
    for (let t = 0; t <= unlockedThrough && t < TIERS.length; t++) {
      tierExposable(t).forEach((id) => ids.push(id));
    }
    return ids;
  }

  function blankRecord() {
    return { mastery: 0, mastered: false, reviewEvery: 3, ordersUntilReview: 3, wrongStep: null };
  }

  function ensureRecords(progress) {
    exposedIds(progress.unlockedThrough).forEach((id) => {
      if (!progress.drinks[id]) progress.drinks[id] = blankRecord();
    });
    return progress;
  }

  function hintStage(mastery) {
    const m = mastery || 0;
    if (m >= 80) return 4;
    if (m >= 60) return 3;
    if (m >= 40) return 2;
    if (m >= 20) return 1;
    return 0;
  }

  function stars(mastery) {
    const n = Math.max(0, Math.min(5, Math.round((mastery || 0) / 20)));
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }

  function dropStage(rec) {
    const stage = hintStage(rec.mastery);
    if (stage === 0) rec.mastery = Math.max(0, (rec.mastery || 0) - 8);
    else rec.mastery = STAGE_FLOOR[stage] - 1;
    if (rec.mastery < 80) rec.mastered = false;
    return rec;
  }

  function grantMastery(rec, opts) {
    let gain = 0;
    if (opts.clean && opts.inTime) gain = opts.hintsOff ? 22 : 16;
    else if (opts.clean) gain = 8;
    rec.mastery = Math.min(100, (rec.mastery || 0) + gain);
    if (opts.clean && opts.inTime && opts.hintsOff && rec.mastery >= 80) {
      const was = !!rec.mastered;
      rec.mastered = true;
      if (!was) {
        rec.reviewEvery = 3;
        rec.ordersUntilReview = 3;
      } else {
        const idx = REVIEW_LADDER.indexOf(rec.reviewEvery);
        const next = REVIEW_LADDER[Math.min(REVIEW_LADDER.length - 1, (idx < 0 ? 0 : idx) + 1)];
        rec.reviewEvery = next;
        rec.ordersUntilReview = next;
      }
    }
    return rec;
  }

  function tierAverage(progress, tierIndex) {
    const ids = tierExposable(tierIndex);
    if (!ids.length) return 100;
    const sum = ids.reduce((total, id) => {
      const rec = progress.drinks[id] || blankRecord();
      return total + (rec.mastery || 0);
    }, 0);
    return sum / ids.length;
  }

  /* Returns the tier index to open, or -1. Does not mutate. */
  function peekUnlock(progress) {
    const tier = progress.unlockedThrough || 0;
    if (tierAverage(progress, tier) < 60) return -1;
    let next = tier + 1;
    while (next < TIERS.length && tierExposable(next).length === 0) next += 1;
    if (next >= TIERS.length || !tierExposable(next).length) return -1;
    return next;
  }

  function sizeVaries(drink) {
    const sigs = drink.builds.map((build) => build.steps.map((step) => {
      return (step.ingredient || '') + ':' + JSON.stringify(step.amount || {});
    }).join('|'));
    return new Set(sigs).size > 1;
  }

  function largeFillDiffers(drink) {
    const large = drink.builds.filter((b) => b.size === 'Large')[0];
    const med = drink.builds.filter((b) => b.size === 'Medium')[0];
    if (!large || !med) return false;
    const sig = (build) => build.steps.map((step) => {
      if (!step.amount) return '';
      return step.amount.fill_line || step.amount.fill || '';
    }).join(',');
    return sig(large) !== sig(med);
  }

  function weightFor(drink, rec) {
    const mastery = rec && rec.mastery ? rec.mastery : 0;
    let weight = 24 + (100 - mastery);
    if (rec && rec.wrongStep) weight += 55;
    if (sizeVaries(drink)) weight += 42;
    if (largeFillDiffers(drink)) weight += 18;
    if (rec && rec.mastered) weight *= 0.4;
    return weight;
  }

  function weightedPick(ids, weights, rng) {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = rng() * total;
    for (let i = 0; i < ids.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return ids[i];
    }
    return ids[ids.length - 1];
  }

  function bubbleFor(drink, size, oz, flavor) {
    let line2 = drink.name;
    if (drink.id === 'iced-coffee-double-double') line2 = flavor ? 'Double Double +' : 'Double Double';
    if (drink.id === 'caramel-iced-capp') line2 = 'Caramel Iced Capp';
    return { line1: size + ' · ' + oz + ' oz', line2: line2 };
  }

  function pickOrder(progress, rng) {
    rng = rng || Math.random;
    const ids = exposedIds(progress.unlockedThrough || 0);
    if (!ids.length) throw new Error('No drinks on the menu');
    const due = ids.filter((id) => {
      const rec = progress.drinks[id];
      return rec && rec.mastered && (rec.ordersUntilReview || 0) <= 0;
    });
    let id;
    if (due.length && rng() < 0.22) id = due[Math.floor(rng() * due.length)];
    else {
      const weights = ids.map((drinkId) => weightFor(byId[drinkId], progress.drinks[drinkId]));
      id = weightedPick(ids, weights, rng);
    }
    const drink = byId[id];
    let sizes = drink.sizes_available.slice();
    if (largeFillDiffers(drink) && rng() < 0.55) sizes = ['Large'];
    const size = sizes[Math.floor(rng() * sizes.length)];
    const canFlavor = drink.builds.some((build) => build.steps.some((step) => step.optional && step.station === 'Syrup Pumps'));
    const flavor = !!(canFlavor && rng() < 0.62);
    const build = drink.builds.filter((b) => b.size === size)[0];
    const steps = expandBuild(drink, size, { flavor: flavor });
    const name = size + ' ' + drink.name + (flavor ? ' · with flavor' : '');
    return {
      id: id,
      name: name,
      size: size,
      oz: build.cup_oz,
      flavor: flavor,
      steps: steps,
      bubble: bubbleFor(drink, size, build.cup_oz, flavor)
    };
  }

  function noteOrder(progress, pickedId) {
    progress.seen = (progress.seen || 0) + 1;
    Object.keys(progress.drinks).forEach((id) => {
      const rec = progress.drinks[id];
      if (rec.mastered && id !== pickedId) rec.ordersUntilReview = (rec.ordersUntilReview || 0) - 1;
    });
  }

  function ticketView(order, mastery) {
    const stage = hintStage(mastery);
    const lines = [];
    if (stage === 0) {
      order.steps.forEach((step, index) => lines.push((index + 1) + '. ' + step.hint));
    } else if (stage === 1) {
      lines.push('Follow the glowing station');
    } else if (stage === 3) {
      lines.push('1. ' + order.steps[0].hint);
    } else if (stage === 4) {
      lines.push('You know this one');
    }
    return {
      stage: stage,
      label: STAGE_LABEL[stage],
      glow: stage <= 1,
      lines: lines,
      icons: stage === 2 ? order.steps.map((step) => step.icon) : [],
      stars: stars(mastery)
    };
  }

  function shortName(ingredient) {
    const name = ingredient || '';
    if (/cane/i.test(name)) return 'Cane';
    if (/flavor/i.test(name)) return 'Flavor';
    if (/caramel/i.test(name)) return 'Caramel';
    if (/chocolate/i.test(name)) return 'Chocolate';
    if (/vanilla/i.test(name)) return 'Vanilla';
    if (/neutral/i.test(name)) return 'Neutral Base';
    if (/java mix/i.test(name)) return 'Java Mix';
    if (/cold brew/i.test(name)) return 'Cold brew';
    if (/iced coffee/i.test(name)) return 'Iced coffee';
    if (/lemonade/i.test(name)) return 'Lemonade';
    if (/iced tea|sweet or unsweet/i.test(name)) return 'Iced tea';
    if (/cream/i.test(name)) return 'Cream';
    if (/milk/i.test(name)) return 'Milk';
    return name;
  }

  function correctChoiceId(step) {
    if (step.kind === 'cup') return 'size:' + step.accept.size;
    if (step.kind === 'pumps') return 'pumps:' + step.accept.ingredient + ':' + step.accept.pumps;
    if (step.kind === 'fill') return 'fill:' + step.accept.ingredient + ':' + step.accept.fill;
    if (step.kind === 'lid') return 'lid:' + step.accept.lid;
    if (step.kind === 'drizzle') return 'drizzle:' + shortName(step.accept.ingredient);
    if (step.kind === 'dairy') {
      if (!step.accept.fill && /cold dairy|dairy alt/i.test(step.accept.ingredient || '')) return 'dairy:cold';
      return 'dairy:' + shortName(step.accept.ingredient) + ':' + (step.accept.fill || '');
    }
    if (step.kind === 'shots') return 'shots:' + step.accept.shots;
    return 'simple';
  }

  function dedupe(list) {
    const seen = {};
    return list.filter((item) => {
      if (seen[item.id]) return false;
      seen[item.id] = true;
      return true;
    });
  }

  function choicesFor(step) {
    if (!step || step.kind === 'simple') return null;
    let list = [];
    if (step.kind === 'cup') {
      list = step.sizes.map((size) => ({ id: 'size:' + size, label: size }));
    } else if (step.kind === 'pumps') {
      const catalog = [
        ['Cane sugar syrup', 2], ['Cane sugar syrup', 3], ['Cane sugar syrup', 4],
        ['Flavored syrup', 3], ['Flavored syrup', 4], ['Flavored syrup', 5],
        ['Caramel syrup', 2], ['Caramel syrup', 3], ['Caramel syrup', 4],
        ['Vanilla syrup', 2], ['Vanilla syrup', 3], ['Vanilla syrup', 4],
        ['Chocolate syrup', 3], ['Chocolate syrup', 4], ['Chocolate syrup', 5]
      ];
      list = catalog.map((pair) => ({
        id: 'pumps:' + pair[0] + ':' + pair[1],
        label: shortName(pair[0]) + ' ×' + pair[1]
      }));
    } else if (step.kind === 'fill') {
      const lines = ['1st', '2nd', '3rd', '4th'];
      if (step.stationId === 'javamix') {
        lines.forEach((line) => list.push({ id: 'fill:Java Mix:' + line, label: 'Java Mix · ' + line }));
        list.push({ id: 'fill:Neutral Base:4th', label: 'Neutral Base · 4th' });
      } else if (step.stationId === 'icedcoffee') {
        ['2nd', '3rd', '4th'].forEach((line) => list.push({ id: 'fill:Iced coffee:' + line, label: 'Iced coffee · ' + line }));
        list.push({ id: 'fill:Cold brew:3rd', label: 'Cold brew · 3rd' });
      } else if (step.stationId === 'lemonade') {
        ['2nd', '3rd', '4th'].forEach((line) => list.push({ id: 'fill:Lemonade:' + line, label: 'Lemonade · ' + line }));
        list.push({ id: 'fill:Sweet or unsweetened iced tea:3rd', label: 'Iced tea · 3rd' });
      } else {
        lines.forEach((line) => {
          list.push({ id: 'fill:' + step.accept.ingredient + ':' + line, label: shortName(step.accept.ingredient) + ' · ' + line });
        });
      }
    } else if (step.kind === 'dairy') {
      list = [
        { id: 'dairy:Cream:1st', label: 'Cream · 1st' },
        { id: 'dairy:Milk:1st', label: 'Milk · 1st' },
        { id: 'dairy:cold', label: 'Cold dairy' },
        { id: 'dairy:Cream:2nd', label: 'Cream · 2nd' }
      ];
    } else if (step.kind === 'lid') {
      list = [
        { id: 'lid:Dome', label: 'Dome lid' },
        { id: 'lid:Strawless', label: 'Strawless lid' },
        { id: 'lid:Hot', label: 'Hot lid' }
      ];
    } else if (step.kind === 'drizzle') {
      list = [
        { id: 'drizzle:Caramel', label: 'Caramel' },
        { id: 'drizzle:Chocolate', label: 'Chocolate' },
        { id: 'drizzle:Vanilla', label: 'Vanilla' }
      ];
    } else if (step.kind === 'shots') {
      [1, 2, 3, 4].forEach((n) => list.push({ id: 'shots:' + n, label: n + ' shots' }));
    }
    const correct = correctChoiceId(step);
    if (step.kind !== 'simple' && !list.some((item) => item.id === correct)) {
      list.push({ id: correct, label: step.hint });
    }
    return dedupe(list);
  }

  function choiceOk(step, choiceId) {
    if (!step || step.kind === 'simple') return true;
    return choiceId === correctChoiceId(step);
  }

  function scoreFor(clean, inTime) {
    if (clean && inTime) return { points: 150, revenue: 4.29, perfect: true };
    if (clean) return { points: 90, revenue: 4.29, perfect: false };
    return { points: 70, revenue: 3.5, perfect: false };
  }

  function drinkName(id) {
    return byId[id] ? byId[id].name : id;
  }

  root.TBR = {
    ORDER_SECONDS: ORDER_SECONDS,
    RECIPES: RECIPES,
    TIERS: TIERS,
    byId: byId,
    isPlayable: isPlayable,
    exposable: exposable,
    tierExposable: tierExposable,
    exposedIds: exposedIds,
    ensureRecords: ensureRecords,
    hintStage: hintStage,
    stars: stars,
    dropStage: dropStage,
    grantMastery: grantMastery,
    tierAverage: tierAverage,
    peekUnlock: peekUnlock,
    sizeVaries: sizeVaries,
    largeFillDiffers: largeFillDiffers,
    weightFor: weightFor,
    pickOrder: pickOrder,
    noteOrder: noteOrder,
    ticketView: ticketView,
    choicesFor: choicesFor,
    choiceOk: choiceOk,
    correctChoiceId: correctChoiceId,
    scoreFor: scoreFor,
    drinkName: drinkName,
    expandBuild: expandBuild,
    STAGE_LABEL: STAGE_LABEL
  };
})(typeof window !== 'undefined' ? window : globalThis);
