// Damamondo – il regolamento completo da leggere nel menu "Regole".
// Regolamento ufficiale (novembre 2026) con le correzioni decise dall'utente.
// Le tabelle sono create dai dati del gioco (data.js), così regole e gioco dicono sempre la stessa cosa.
(function (DM) {
  'use strict';
  const n = DM.fmtN, T = DM.TROOPS;
  const table = (head, rows) => '<div class="tw"><table><thead><tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
  const ul = items => '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
  const qty = (m, q) => DM.unitOf(m) === 'kg' && q >= 1000 && q % 1000 === 0 ? n(q / 1000) + ' t ' + m : n(q) + ' ' + DM.unitOf(m) + ' ' + m;
  const cost = k => DM.COST[k].map(o => n(o.m) + ' soldi' + Object.keys(o.r).map(m => ' + ' + qty(m, o.r[m])).join('')).join('<br>oppure ');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const BIO_LAND = 'PDGLTMAHVZI';

  DM.rulesHTML = function () {
    const ch = [];
    const add = (title, html) => ch.push({ title, html });

    add('Introduzione', `<p>Damamondo è un gioco da tavolo di strategia. Ogni giocatore guida un popolo: costruisce città, porti e miniere, vende i minerali, addestra truppe e si espande conquistando territori.</p>
      <p><b>Obiettivo.</b> Sconfiggere gli avversari. In alternativa i giocatori possono decidere di simulare una realtà in cui pochi o nessuno vengono sconfitti e la partita dura all'infinito.</p>
      <p><b>Come si perde.</b> Chi rimane senza Capitale e senza una Città in cui trasferirla perde (capitolo 7).</p>
      <p><b>Mappa.</b> 60 × 42 cm, cioè 4 fogli A4 (Fogli 1 e 2 sopra, 3 e 4 sotto). Il bordo esterno è sempre mare. Le distanze si misurano in cm; le velocità sono in cm per turno.</p>
      <p><b>Notazione.</b> «:» vuol dire diviso, «x» vuol dire per. I danni cambiati da biomi e bacche si arrotondano alla decina più vicina. Se un numero compare in due intervalli di una tabella, vale l'intervallo che viene prima (5–10 e 11–15, non 10–15).</p>`);

    add('Preparazione e kit di partenza', `<p>Si sceglie quanti giocano (da 2 a 6, poi possono nascerne altri con le cessioni). Ogni giocatore sceglie il suo kit e piazza la Capitale.</p>` +
      table(['', ...DM.KITS.map(k => k.name)], [
        ['Soldi', ...DM.KITS.map(k => n(k.money))],
        ['Soldati', ...DM.KITS.map(k => k.S || '–')], ['Navi', ...DM.KITS.map(k => k.N || '–')], ['Elicotteri', ...DM.KITS.map(k => k.E || '–')],
        ['Accampamenti', ...DM.KITS.map(k => k.acc || '–')], ['Città', ...DM.KITS.map(k => k.citta || '–')], ['Porti', ...DM.KITS.map(k => k.porto || '–')],
        ['Miniere', ...DM.KITS.map(k => k.min ? k.min + (k.diceChoice ? ' (*)' : '') : '–')], ['Aeroporti', ...DM.KITS.map(k => k.aer || '–')],
        ['Pezzi di ponte liv. 1', ...DM.KITS.map(k => k.ponte1 || '–')], ['Materiali', ...DM.KITS.map(k => k.materials ? '1 punto di ogni materiale' : '–')],
        ['Pozioni', ...DM.KITS.map(k => k.potions ? '2 di ogni tipo (1 di Stipendio+)' : '–')]]) +
      `<p>(*) Il giocatore sceglie il risultato del dado per ciascuna delle due miniere. Tribù è il kit standard.</p>` +
      ul(['Ogni kit comprende la Capitale e 1 Carro.', 'La prima Città o Capitale ha un <b>Aeroporto gratis</b> dentro.',
        'La Capitale non si può mettere in Mare, Giungla, Palude, Alta montagna, fiumi e laghi, Lavico e Banchisa.',
        'Distanza minima tra Capitali: <b>15 cm con 2 giocatori, 10 cm con 3 o più</b>.',
        'Le truppe del kit restano in riserva: il giocatore le schiera dentro o vicino a un edificio adatto.']));

    const lim = [[1, 4], [5, 10], [11, 15], [16, 20], [21, null]];
    add('Il turno', `<p>Nel suo turno un giocatore muove e spara con le sue truppe, eserciti e flotte, nei limiti della tabella. Il limite dipende dal giro. Il turno finisce quando il giocatore lo decide (o ha finito mosse e spari). Un giro finisce quando tutti hanno giocato.</p>` +
      table(['Giro', 'Si può muovere', 'Si può sparare'], lim.map(([a, b]) => [b ? `dal ${a}° al ${b}°` : `dal ${a}° in poi`, DM.moveLimit(a) + (DM.moveLimit(a) === 1 ? ' truppa / esercito / flotta' : ''), DM.shotLimit(a)])) +
      `<h4>Bombe, Superbombe e bacche</h4>` + ul([
        'Lanciare una <b>Bomba</b> vale 3 spari. Si possono lanciare più Bombe nello stesso turno, rispettando il limite. Si può lanciare anche quando il limite è sotto 3: in quel caso se ne lancia una sola (e non si spara altro).',
        'Lanciare una <b>Superbomba</b> vale 5 spari e <b>non</b> fa finire il turno.',
        'Lanciare una bacca non conta come sparo. Al massimo 1 bacca per turno.']));

    add('Le truppe', `<p>Le truppe nascono nelle Città, nella Capitale e negli Accampamenti (le navi nei Porti, l'Aereo Carro negli Aeroporti).</p>` +
      table(['Truppa', 'Gittata (cm)', 'Danno', 'Vita', 'Velocità (cm)'], DM.TROOP_KEYS.split('').map(k => {
        const t = T[k];
        const v = t.kind === 'air' ? t.air : t.kind === 'sea' ? t.sea + ' in mare' + (t.river ? ', ' + t.river + ' sui fiumi' : '') : t.land.P;
        return [t.name, t.range || '–', n(t.dmg), n(t.hp), v];
      })) +
      `<h4>Costi</h4>` + table(['Truppa', 'Costo'], DM.TROOP_KEYS.split('').map(k => [T[k].name, cost(k)])) +
      `<h4>Regole speciali</h4>` + ul([
        '<b>Chi spara sceglie il bersaglio</b>: una truppa, un esercito, le truppe che stanno dentro un edificio (valgono come un esercito) oppure l\'edificio. Le truppe sparano solo alle cose degli altri giocatori, mai alle proprie.',
        '<b>Truppe aeree</b> (Elicottero, Aereo Carro): le colpiscono solo Soldati, Navi e Carrarmati.',
        '<b>Nave</b>: si muove sul mare e sui fiumi. Parte da un Porto, oppure da un fiume se c\'è una tua Città entro 1 cm.',
        '<b>Nave Carro</b>: non naviga nei fiumi. Sulla Banchisa va a 6 cm (è una specie di rompighiaccio).',
        '<b>Elicottero</b>: velocità 4; quando parte da un Aeroporto ha +2 cm (solo alla partenza).',
        '<b>Aereo Carro</b>: parte e atterra solo negli Aeroporti, e solo lì carica e posa truppe e materiali.',
        '<b>Carro</b>: porta materiali, soldi, bombe, pozioni e bacche. Non ha attacco. Le strade non raddoppiano la sua velocità.',
        'Costruire una Nave Carro o un Aereo Carro dà in regalo un Carro, che parte già a bordo.']));

    add('Eserciti e flotte', `<p>Un esercito è un gruppo di truppe che si muovono e attaccano insieme. Un esercito con almeno una Nave o una Nave Carro si chiama flotta. Le truppe si uniscono se sono entro 1 cm l'una dall'altra.</p>` + ul([
      '<b>Movimento</b>: l\'esercito va alla velocità della sua truppa più lenta.',
      '<b>Sparo</b>: ogni truppa spara con le sue statistiche. Un esercito conta come 1 solo sparo del limite, ma possono sparare fino al doppio del limite di truppe. Esempio: al 16° giro il limite è 5, quindi un esercito fa sparare fino a 10 truppe contando 1 sparo.',
      '<b>Compatibilità</b>: le Navi stanno solo con Navi, Elicotteri e Navi Carro. La Nave Carro sta con Navi, Elicotteri e Aerei Carro, mai con Soldati, Carrarmati e Carri. Un esercito di terra comprende Soldati, Carrarmati, Carri, Elicotteri e Aerei Carro.',
      '<b>Tetto</b>: massimo 100 punti (tabella). Questi punti servono solo per il tetto.']) +
      table(['Truppa', 'Punti in una flotta', 'Punti in un esercito di terra'], DM.TROOP_KEYS.split('').map(k => [T[k].name, DM.FLEET_PTS[k] || '–', DM.LAND_PTS[k] || '–'])));

    const things = DM.MATERIALS.filter(m => m !== 'ossidiana').map(m => [cap(m), qty(m, DM.PER_POINT[m])])
      .concat([['Soldi', n(DM.MONEY_PER_POINT)], ['Bacca (qualsiasi)', '1 bacca'], ['Pozione', '2 punti ciascuna'], ['Bomba', '40 punti ciascuna'], ['Superbomba', '100 punti ciascuna']]);
    add('Trasporto', `<p>Alcune truppe portano altre truppe e cose. Ogni cosa ha un valore in punti.</p>` +
      table(['Veicolo', 'Punti truppa', 'Punti cose'], DM.TROOP_KEYS.split('').map(k => [T[k].name, DM.TROOP_CAP[k] || 0, DM.CARGO_CAP[k] || '–'])) +
      `<h4>Valore delle truppe</h4>` + table(['Truppa', 'Punti truppa'], Object.keys(DM.TROOP_VALUE).map(k => [T[k].name, n(DM.TROOP_VALUE[k])])) +
      `<h4>Valore delle cose (quanto vale 1 punto)</h4>` + table(['Cosa', '1 punto'], things) + ul([
        'Si sale su un veicolo entro 1 cm. Chi è a bordo non si muove e non spara finché non scende.',
        'Sulle navi si sale e si scende solo <b>dentro un proprio Porto</b>; dal Porto si va a terra camminando sul molo.',
        'Quando un veicolo viene distrutto, scendono le truppe che portava e in più 1 Soldato (l\'autista). In mare aperto si perdono.',
        'La Nave Carro e l\'Aereo Carro non si possono trasportare.',
        'Il Carro è il mezzo per spostare soldi e materiali tra le città: i soldi non si trasferiscono da soli. Soldi a multipli di 1.000, materiali a peso intero.']));

    add('Soldi, Città e Capitale', table(['Edificio', 'Rendita', 'Ogni'], [['Città', n(DM.INCOME.citta), '10 giri'], ['Capitale', n(DM.INCOME.cap), '10 giri']]) + ul([
      'La rendita si conta dal giro di costruzione: una Città costruita all\'8° giro paga al 18°.',
      'Ogni Città deve avere dentro almeno 5.000 soldi, altrimenti conta come Accampamento (niente rendita).',
      'L\'Accampamento serve solo a far nascere truppe. Diventa Città pagando solo la differenza di costo.',
      'Se una Città (o un altro edificio) viene distrutta si perde tutto quello che c\'era dentro: soldi, bacche, minerali, pozioni e bombe. Le truppe dentro <b>non</b> muoiono, a meno che non le colpisca una Bomba.',
      '<b>Capitale distrutta</b>: si sposta da sola in una Città che abbia almeno il 50% dei soldi del giocatore. Se nessuna Città li ha, il giocatore ha tutto il tempo che vuole per portarli (con il Carro) e scegliere la nuova Capitale, ma perde 10.000 soldi a ogni suo turno. Senza Capitale e senza Città, perde.']));

    add('Edifici e armi', table(['Edificio', 'Vita', 'Costo'], [['Capitale', n(DM.BUILDING_HP.cap), 'nel kit'], ['Città', n(DM.BUILDING_HP.citta), cost('citta')],
      ['Accampamento', n(DM.BUILDING_HP.acc), cost('acc')], ['Porto', n(DM.BUILDING_HP.porto), cost('porto')], ['Aeroporto', n(DM.BUILDING_HP.aer), cost('aer')],
      ['Coltivazione', n(DM.BUILDING_HP.col), cost('col')], ['Miniera', n(DM.BUILDING_HP.min), cost('min')],
      ['Ponte liv. 1', n(DM.BRIDGE_HP[1]), cost('ponte1') + ' per pezzo (1 cm)'], ['Ponte liv. 2', n(DM.BRIDGE_HP[2]), cost('ponte2') + ' per pezzo (1 cm)'],
      ['Strada', '5.000', n(DM.ROAD_COST.m) + ' soldi + 2 t ferro + 100 kg oro per pezzo (max 5 cm)']]) +
      '<p>Gli edifici si costruiscono nel proprio territorio, con una propria truppa entro 2 cm, e mai su mare, fiumi, Banchisa e Lavico. Niente città in Giungla, Palude e Alta montagna. La Coltivazione si costruisce solo in Deserto, Giungla, Palude e Tundra (gli unici biomi che danno bacche).</p>' +
      '<h4>Porti</h4>' + ul(['Le Navi partono da un Porto. Sui fiumi il Porto non serve se c\'è una propria Città entro 1 cm.', 'Il Porto si costruisce in acqua (mare, fiume o lago) con terra propria entro 1 cm, oppure dentro una Città che sia entro 0,2 cm dall\'acqua. Sui fiumi di solito non serve, perché le Navi partono già dalle Città vicine.']) +
      '<h4>Aeroporti</h4><p>Servono per far partire e atterrare l\'Aereo Carro e danno agli Elicotteri +2 cm alla partenza. Si costruiscono anche dentro una Città.</p>' +
      '<h4>Ponti</h4>' + ul(['Si comprano a <b>pezzi</b>: ogni pezzo vale 1 cm di ponte. Per posarlo si tocca la terra sulle due rive: il ponte copre l\'acqua tra le rive e usa un pezzo per ogni cm, arrotondato per eccesso (un ponte di 0,7 cm usa 1 pezzo, uno di 1,3 cm ne usa 2). Serve una propria truppa entro 2 cm e almeno una riva nel proprio territorio.',
        'Liv. 1: attraversa fiumi e laghi (non il mare). I Carrarmati non ci passano sopra e le Navi non ci passano sotto.',
        'Liv. 2: le Navi ci passano sotto e i Carrarmati sopra. Sul mare si può fare solo se è più corto di 2 cm. Se lo colpisce una Bomba torna di livello 1.',
        'I ponti si attaccano solo con Bombe, Superbombe e Navi.']) +
      '<h4>Strade</h4>' + ul(['Collegano due edifici propri, oppure un edificio e l\'estremità di un proprio ponte; ogni pezzo è lungo al massimo 5 cm e si paga solo la parte sulla terra.',
        'Quando trova l\'acqua la strada si interrompe; si collega al ponte e il viaggio continua sopra il ponte.',
        'Chi viaggia sulla strada va a velocità doppia (non le Navi, le truppe volanti e il Carro). Il viaggio può passare da più edifici collegati.',
        'Dove non si costruiscono città (Giungla, Palude, Alta montagna) costano il doppio. Mai su Banchisa e Lava.']) +
      '<h4>Bombe e Superbombe</h4>' + table(['Arma', 'Danno', 'Gittata', 'Costo'], [['Bomba', n(DM.BOMB.bomba.dmg), '15 cm dalla Città (10 dall\'Accampamento)', cost('bomba')], ['Superbomba', n(DM.BOMB.superbomba.dmg), '30 cm dalla Città', cost('superbomba')]]) +
      ul(['La gittata si conta dall\'edificio in cui si trova la bomba. Le Superbombe partono solo da Capitale e Città.',
        'Chi lancia sceglie il bersaglio, anche tra le cose proprie (per esempio la propria Città, per distruggerla prima che la conquistino).',
        'Bomba: danno ad area. Se colpisce un esercito, colpisce tutte le sue truppe. Se colpisce un edificio, colpisce anche tutto quello che c\'è dentro, truppe comprese.',
        'Superbomba: colpisce tutto entro 0,5 cm dal punto d\'impatto e lascia un\'area radioattiva per 3 giri (12.7).']));

    add('Miniere', ul(['Si costruisce con una propria truppa entro 2 cm, ad almeno 2 cm dalle altre miniere. Costa 5.000 soldi e la costruzione è garantita.',
      'Dopo la costruzione si tira un dado: il minerale dipende dal bioma (tabella).',
      'Produce subito una prima quantità, poi la stessa ogni 5 giri, finché non viene distrutta o non è più nel territorio del proprietario.',
      'Un nemico prende una miniera conquistando il territorio, oppure se gliela vendi.']) +
      table(['Bioma', '1', '2', '3', '4', '5', '6'], Object.keys(DM.MINE_TABLE).map(b => [DM.BIOME_NAME[b], ...DM.MINE_TABLE[b].split(' ').map(cap)])) +
      '<h4>Quanto produce</h4>' + table(['Materiale', 'Quantità'], DM.MATERIALS.map(m => [cap(m), qty(m, DM.QTY[m])])));

    add('Il Banco e gli scambi', '<p>Il Banco compra i materiali, solo a multipli della quantità indicata. In un turno si vende un solo tipo di materiale. I soldi restano nell\'edificio da cui vengono i minerali.</p>' +
      table(['Materiale', 'Quantità', 'Prezzo'], DM.MATERIALS.map(m => [cap(m), qty(m, DM.BANK[m][0]), n(DM.BANK[m][1])])) +
      ul(['Gli scambi tra giocatori sono sempre possibili: ci si incontra in un porto o in una città, poi si posano materiali e soldi dove si preferisce.', 'Durante uno scambio l\'eventuale tregua è decisa dai giocatori e si basa sulla fiducia.']));

    add('Territori e conquista', ul(['<b>Terre mai conquistate</b>: le truppe che si avvicinano prendono tutto il territorio entro 2 cm. Resta loro anche quando se ne vanno.',
      '<b>Territori nemici</b>: le truppe devono restare 3 giri entro 2 cm, e solo se in quel raggio non ci sono truppe nemiche.',
      'Città, Capitali, miniere, coltivazioni e altri edifici nel cerchio passano al conquistatore con tutto quello che contengono (anche le Bombe), tranne le truppe avversarie.',
      'Un giocatore può cedere una parte del suo territorio (a un altro giocatore, a nessuno, o a un nuovo giocatore che nasce lì con un suo kit) o un singolo edificio.']));

    const spRow = k => DM.TROOP_KEYS.split('').map(t => {
      const d = T[t];
      if (k === 'F') return d.kind === 'land' ? (t === 'C' ? '–' : 'ponte') : d.kind === 'sea' ? (d.river || '–') : d.air;
      if (d.kind === 'air') return d.air;
      if (d.kind === 'sea') return k === 'I' ? d.ice : '–';
      return d.land[k] !== undefined ? String(d.land[k]).replace('.', ',') : '–';
    });
    add('I biomi', table(['Bioma', 'Effetti'], [['Pianura', 'nessuno'], ['Deserto', 'danno :1,5'], ['Giungla', 'danno x1,5; niente città'], ['Palude', 'niente città; il livello di umidità più alto'],
      ['Tundra', 'gittata x2, velocità :2'], ['Montagna', 'velocità :2; niente bacche'], ['Alta montagna', 'niente città, niente bacche; confina solo con la Montagna'], ['Fiume / lago', 'Soldati e Carrarmati lo attraversano con i ponti']]) +
      '<h4>Velocità nei biomi (cm per turno)</h4>' + table(['Bioma', ...DM.TROOP_KEYS.split('').map(k => T[k].name)], BIO_LAND.split('').concat('F').map(b => [DM.BIOME_NAME[b], ...spRow(b)])) +
      '<h4>Danno nei biomi</h4>' + table(['Bioma', ...Object.keys(DM.BIOME_DMG).map(k => T[k].name)], ['D', 'G'].map(b => [DM.BIOME_NAME[b], ...Object.keys(DM.BIOME_DMG).map(k => n(DM.BIOME_DMG[k][b]))])) +
      '<p>Nella Tundra la gittata raddoppia per Soldato, Elicottero e Carrarmato. Le truppe marine e aeree non subiscono i malus di velocità del terreno. Nave Carro e Aereo Carro cambiano statistiche solo con le bacche.</p>' +
      '<h4>Vulcanico e Lavico</h4>' + ul(['Ogni 10 giri si tira un dado per ogni vulcano: con 1 il terreno entro 1 cm dal Vulcanico diventa Lavico per 3 giri, e truppe ed edifici lì vengono distrutti (la pozione Ignifuga protegge un edificio).',
        'Lavico: velocità :2. Brucia le truppe per 3 turni (Soldato 20, Carrarmato 500, Carro 500 a turno); la bruciatura non si somma. Le truppe aeree non atterrano nel Lavico. Esistono zone di lava perenne.',
        'Vulcanico e Lavico non cambiano gittata e danno.']) +
      '<h4>Glaciale e Banchisa</h4>' + ul(['Glaciale: niente bacche, nessun effetto su velocità, gittata e danno.',
        'Banchisa: ghiaccio su mare, laghi e fiumi. Velocità :2 per truppe di terra e di mare; la Nave va a 1,5 cm e la Nave Carro a 6 cm. Le truppe aeree non atterrano e non si costruisce niente (nemmeno strade).']) +
      '<h4>Area radioattiva</h4><p>La lascia la Superbomba: dura 3 giri, anche sul mare, e dimezza la velocità dopo il malus del bioma, arrotondando per eccesso al millimetro. Esempio: un Soldato nel Deserto va a 0,3 cm; nell\'area radioattiva 0,3 : 2 = 0,15 → 0,2 cm.</p>');

    add('Le bacche', ul(['Crescono nelle Coltivazioni, una ogni 5 giri, del bioma in cui si trova la Coltivazione. Non ci sono bacche in Pianura, Montagna, Alta montagna, Vulcanico, Glaciale e Banchisa.',
      'Si lanciano da Capitale, Città e Accampamenti, con la gittata delle Bombe (15 cm, 10 dagli Accampamenti), su qualsiasi truppa (proprie o degli altri): decide chi lancia. L\'effetto dura 3 giri e colpisce tutto l\'esercito.',
      'Al massimo 1 bacca per turno; non conta come sparo.']) +
      table(['Bacca', 'Effetto per 3 giri'], [['Deserto', 'danno :1,5'], ['Giungla', 'danno x1,5'], ['Palude', 'velocità :5'], ['Tundra', 'gittata x2']]) +
      '<p>Se la truppa è nel bioma della bacca, il primo effetto vale normalmente e il secondo aggiunge o toglie una quantità fissa. Deserto e Giungla insieme si annullano.</p>' +
      table(['Truppa', 'Deserto (danno)', 'Giungla (danno)', 'Tundra (gittata)', 'Palude (velocità)'], DM.TROOP_KEYS.split('').map(k => [T[k].name, ...DM.BERRY_STACK[k].map(v => v ? (v > 0 ? '+' : '') + String(v).replace('.', ',') : '–')])));

    const PZ = { poz_stipendio: '3 truppe o eserciti a scelta fanno il doppio dei danni per 1 turno.', poz_velocita: 'Una truppa o un esercito va 1 cm in più; nei biomi con malus la velocità raddoppia (dopo il malus).',
      poz_curacitta: 'Cura gli Accampamenti di 1.000, le Città di 2.000 e le Capitali di 4.000.', poz_concime: 'Toglie 2 turni all\'attesa di una Coltivazione.', poz_miglioracitta: 'Aggiunge 10.000 di rendita e 5.000 di vita a una Città.',
      poz_curatruppe: 'Cura 1 truppa del 50% della sua vita, solo dentro Città o Accampamento (Navi anche nel Porto, Elicotteri e Aereo Carro anche nell\'Aeroporto).', poz_ignifuga: 'Protegge 1 edificio dalle eruzioni finché non viene distrutto.' };
    add('Le pozioni', table(['Pozione', 'Costo', 'Effetto'], Object.keys(PZ).map(k => [DM.POTIONS[k], cost(k), PZ[k]])));

    add('Consigli di gioco', '<p>Non sono regole, solo suggerimenti.</p>' + ul(['Se una tua città sta per essere conquistata, puoi bombardarla tu stesso per distruggerla prima, oppure scappare con il Carro portando via soldi e materiali.']));

    add('Glossario', table(['Termine', 'Significato'], [['Truppa', 'Una singola unità: Soldato, Nave, Elicottero, Carrarmato, Carro, Nave Carro o Aereo Carro.'], ['Esercito', 'Insieme di truppe che si muovono e attaccano insieme.'],
      ['Flotta', 'Esercito con almeno una Nave o una Nave Carro.'], ['Spawn', 'La nascita di una truppa in una Città, nella Capitale o in un Accampamento.'], ['Banco', 'Il compratore dei materiali.'],
      ['Gittata', 'La distanza (in cm) a cui una truppa o un\'arma può colpire.'], ['Buff / nerf', 'Un aumento o una diminuzione di velocità, danno o gittata.'], ['Territorio', 'L\'area conquistata da un giocatore.'], ['Giro', 'Un turno di ogni giocatore.']]));

    return '<nav class="toc"><b>Indice</b><ol>' + ch.map((c, i) => `<li><a href="#reg${i + 1}">${c.title}</a></li>`).join('') + '</ol></nav>' +
      ch.map((c, i) => `<section class="rule" id="reg${i + 1}"><h3>${i + 1}. ${c.title}</h3>${c.html}</section>`).join('');
  };
})(globalThis.DM = globalThis.DM || {});
