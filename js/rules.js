// Damamondo – il regolamento completo da leggere nel menu "Regole".
// Regolamento ufficiale (novembre 2026) con le correzioni decise dall'utente, riscritto in forma di articoli numerati.
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
    // ogni capitolo è fatto di articoli numerati (1.1, 1.2…): art('testo') dà il paragrafo con il suo numero
    let cn = 0, an = 0;
    const art = (text, title) => `<p class="art"><b>${cn}.${++an}</b> ${title ? `<b>${title}.</b> ` : ''}${text}</p>`;
    // riquadri: "Esempio" e "Importante"
    const box = (kind, text) => `<div class="box ${kind}"><b>${kind === 'ex' ? 'Esempio' : 'Importante'}</b>${text}</div>`;
    const add = (title, fn) => { cn = ch.length + 1; an = 0; ch.push({ title, html: fn() }); };

    add('Introduzione e obiettivo', () =>
      art('Damamondo è un gioco di strategia per due o più giocatori. Ciascun giocatore guida un popolo: fonda città, sfrutta le risorse del proprio territorio, commercia con il Banco, addestra truppe ed estende i propri confini.', 'Il gioco') +
      art('Vince il giocatore che sconfigge tutti gli avversari. In alternativa, i giocatori possono accordarsi per una partita aperta, senza vincitore, che prosegue a tempo indeterminato.', 'Obiettivo') +
      art('Un giocatore è eliminato quando perde la Capitale e non dispone di alcuna Città in cui trasferirla (art. 7.5).', 'Sconfitta') +
      art('La mappa misura 60 × 42 cm ed è composta da quattro fogli A4: i fogli 1 e 2 in alto, i fogli 3 e 4 in basso. Il bordo esterno della mappa è sempre mare. Le distanze si misurano in centimetri; le velocità si esprimono in centimetri per turno. Durante la partita si possono aggiungere altri fogli per nuove terre da conquistare.', 'Mappa') +
      art('Per giocare su carta servono i fogli della mappa, un righello, dadi a sei facce (per le miniere e le eruzioni) e un segnalino per ogni elemento del gioco, come indicato nella tabella.', 'Materiale') +
      table(['Elemento', 'Segnalino consigliato'], [['Truppe', 'Perline Hama Midi da 5 mm, un colore per ogni tipo di truppa. Gli eserciti si formano impilando le perline.'], ['Accampamenti', 'Dischetti rotondi di legno'],
        ['Città', 'Cubetti da 1 cm; le Città migliorate si ottengono impilando i cubetti.'], ['Capitale', 'Una stella (oppure un quadrato)'], ['Miniere', 'Esagoni, di un colore diverso per ogni minerale'],
        ['Porti', 'Quadrati blu'], ['Aeroporti', 'Quadrati bianchi'], ['Per tenere fermi i pezzi', 'Patafix o prodotti simili sotto i segnalini']]) +
      art('Il simbolo «:» indica la divisione, il simbolo «x» la moltiplicazione. I danni modificati da biomi e bacche si arrotondano alla decina più vicina. Quando un valore rientra in due intervalli di una tabella, si applica il primo (gli intervalli si leggono 5–10 e 11–15, non 10–15).', 'Convenzioni'));

    add('Preparazione e kit di partenza', () =>
      art('Si stabilisce il numero dei giocatori, da 2 a 6. Nel corso della partita possono entrare nuovi giocatori tramite cessione di territorio (art. 11.4).', 'Giocatori') +
      art('A turno, ciascun giocatore sceglie uno dei kit di partenza indicati nella tabella e colloca la propria Capitale.', 'Scelta del kit') +
      table(['', ...DM.KITS.map(k => k.name)], [
        ['Soldi', ...DM.KITS.map(k => n(k.money))],
        ['Soldati', ...DM.KITS.map(k => k.S || '–')], ['Navi', ...DM.KITS.map(k => k.N || '–')], ['Elicotteri', ...DM.KITS.map(k => k.E || '–')],
        ['Accampamenti', ...DM.KITS.map(k => k.acc || '–')], ['Città', ...DM.KITS.map(k => k.citta || '–')], ['Porti', ...DM.KITS.map(k => k.porto || '–')],
        ['Miniere', ...DM.KITS.map(k => k.min ? k.min + (k.diceChoice ? ' (*)' : '') : '–')], ['Aeroporti', ...DM.KITS.map(k => k.aer || '–')],
        ['Pezzi di ponte liv. 1', ...DM.KITS.map(k => k.ponte1 || '–')], ['Materiali', ...DM.KITS.map(k => k.materials ? '1 punto di ogni materiale' : '–')],
        ['Pozioni', ...DM.KITS.map(k => k.potions ? '2 di ogni tipo (1 di Stipendio+)' : '–')]]) +
      '<p class="note">(*) Per ciascuna di queste miniere il giocatore sceglie il minerale tra quelli che il bioma può produrre, invece di tirare il dado.</p>' +
      art('Ogni kit comprende inoltre la Capitale e un Carro. La prima Città o Capitale di ogni giocatore contiene gratuitamente un Aeroporto. Tribù è il kit standard.', 'Dotazione comune') +
      art('La Capitale non può essere collocata in Mare, Giungla, Palude, Alta montagna, Lavico, Banchisa, né su fiumi o laghi. La distanza minima tra due Capitali è di <b>15 cm con due giocatori</b> e di <b>10 cm con tre o più</b>.', 'Collocazione della Capitale') +
      art('Truppe ed edifici del kit restano nella riserva finché il giocatore non li colloca sulla mappa. Le truppe di terra si schierano entro <b>2 cm dalla Capitale</b> o entro <b>1 cm da una Città o da un Accampamento</b>; l\'Elicottero anche entro 1 cm da un Aeroporto. Navi e Navi Carro si schierano all\'interno di un Porto, l\'Aereo Carro all\'interno di un Aeroporto.', 'Riserva e schieramento'));

    const lim = [[1, 4], [5, 10], [11, 15], [16, 20], [21, null]];
    add('Il turno', () =>
      art('La partita si svolge in giri. In ogni giro ciascun giocatore gioca un turno, sempre nello stesso ordine.', 'Giri e turni') +
      art('Durante il proprio turno il giocatore può muovere e far sparare truppe, eserciti e flotte entro i limiti della tabella seguente, che dipendono dal giro in corso. Può inoltre costruire, acquistare, vendere e trasportare, secondo le regole dei rispettivi capitoli. Il turno termina quando il giocatore lo dichiara concluso.', 'Azioni') +
      table(['Giro', 'Movimenti', 'Spari'], lim.map(([a, b]) => [b ? `dal ${a}° al ${b}°` : `dal ${a}° in poi`, DM.moveLimit(a) + (DM.moveLimit(a) === 1 ? ' (truppa, esercito o flotta)' : ''), DM.shotLimit(a)])) +
      '<h4>Bombe, Superbombe e bacche</h4>' +
      art('Il lancio di una <b>Bomba</b> equivale a 3 spari. Nello stesso turno si possono lanciare più Bombe, nel rispetto del limite. Se gli spari disponibili sono meno di 3, si può comunque lanciare una sola Bomba, rinunciando a ogni altro sparo.', 'Bomba') +
      art('Il lancio di una <b>Superbomba</b> equivale a 5 spari e non conclude il turno.', 'Superbomba') +
      art('Il lancio di una bacca non conta come sparo. Si può lanciare al massimo una bacca per turno.', 'Bacche'));

    add('Le truppe', () =>
      art('Le truppe si acquistano negli edifici del giocatore e si schierano secondo l\'art. 2.5. Le loro caratteristiche sono riportate nelle tabelle seguenti; la velocità indicata è quella in Pianura.', 'Caratteristiche') +
      table(['Truppa', 'Gittata (cm)', 'Danno', 'Vita', 'Velocità (cm)'], DM.TROOP_KEYS.split('').map(k => {
        const t = T[k];
        const v = t.kind === 'air' ? t.air : t.kind === 'sea' ? t.sea + ' in mare' + (t.river ? ', ' + t.river + ' sui fiumi' : '') : t.land.P;
        return [t.name, t.range || '–', n(t.dmg), n(t.hp), v];
      })) +
      '<h4>Costi</h4>' + table(['Truppa', 'Costo'], DM.TROOP_KEYS.split('').map(k => [T[k].name, cost(k)])) +
      '<h4>Regole particolari</h4>' +
      art('Chi spara sceglie il bersaglio: una truppa, un esercito, le truppe all\'interno di un edificio (che contano come un esercito) oppure l\'edificio stesso. Si spara soltanto a truppe ed edifici degli altri giocatori.', 'Bersaglio') +
      art('Elicottero e Aereo Carro possono essere colpiti da qualsiasi truppa.', 'Truppe aeree') +
      art('Si muove in mare e sui fiumi. Parte da un Porto oppure da un fiume, se entro 1 cm si trova una Città del giocatore.', 'Nave') +
      art('Non naviga sui fiumi. Sulla Banchisa mantiene una velocità di 6 cm, poiché funge da rompighiaccio.', 'Nave Carro') +
      art('Velocità di 4 cm; quando parte da un Aeroporto dispone di 2 cm aggiuntivi, validi solo per quel movimento.', 'Elicottero') +
      art('Decolla e atterra soltanto negli Aeroporti, dove carica e scarica truppe e materiali.', 'Aereo Carro') +
      art('Trasporta materiali, soldi, bombe, pozioni e bacche. Non ha capacità di attacco e la strada non ne raddoppia la velocità.', 'Carro') +
      art('Il Carro può essere mosso fino a <b>' + DM.MOVES_PER_TURN.C + ' volte</b> per turno e la Nave Carro fino a <b>' + DM.MOVES_PER_TURN.X + ' volte</b>, ogni volta con tutta la propria velocità; l\'Aereo Carro una sola volta, come le altre truppe. Solo la prima mossa conta nel limite dei movimenti (art. 3.2).', 'Più mosse per i mezzi da carico') +
      box('ex', 'Un Carro in Pianura ha velocità 4 cm: può percorrere 4 cm fino a una miniera per caricare i minerali, altri 4 cm verso la Capitale e altri 4 cm ancora, contando un solo movimento.') +
      art('L\'acquisto di una Nave Carro o di un Aereo Carro comprende un Carro in omaggio, già a bordo.', 'Carro in omaggio'));

    add('Eserciti e flotte', () =>
      art('Un esercito è un gruppo di truppe che si muovono e attaccano insieme. Un esercito che comprende almeno una Nave o una Nave Carro si chiama flotta. Si possono riunire in esercito le truppe che si trovano entro 1 cm l\'una dall\'altra.', 'Definizione') +
      art('L\'esercito si muove alla velocità della sua truppa più lenta.', 'Movimento') +
      art('Quando si spara a un esercito, o alle truppe all\'interno di un edificio, ogni colpo raggiunge una truppa estratta <b>a caso</b> tra quelle ancora in vita; la stessa truppa può essere colpita più volte. Le Bombe, invece, colpiscono tutte le truppe dell\'esercito.', 'Danni subiti') +
      box('ex', '10 Soldati sparano a un esercito di 2 Carrarmati, 1 Elicottero e 10 Soldati. Ciascuno dei 10 colpi da 70 cade su una truppa a caso: per esempio 1 su un Carrarmato e 9 sui Soldati, e un Soldato può essere colpito due volte.') +
      art('Ogni truppa spara con le proprie caratteristiche. Lo sparo di un esercito conta come uno solo ai fini del limite, ma possono sparare al massimo un numero di truppe pari al doppio del limite.', 'Sparo') +
      box('ex', 'Al 16° giro il limite è 5 spari: un esercito può far sparare fino a 10 delle sue truppe, consumando un solo sparo.') +
      art('Le Navi si uniscono soltanto a Navi, Elicotteri e Navi Carro. La Nave Carro si unisce a Navi, Elicotteri e Aerei Carro, mai a Soldati, Carrarmati e Carri. Un esercito di terra può comprendere Soldati, Carrarmati, Carri, Elicotteri e Aerei Carro.', 'Composizione') +
      art('Un esercito o una flotta non può superare i 100 punti indicati nella tabella seguente. Questi punti valgono soltanto per tale limite.', 'Dimensione massima') +
      table(['Truppa', 'Punti in una flotta', 'Punti in un esercito di terra'], DM.TROOP_KEYS.split('').map(k => [T[k].name, DM.FLEET_PTS[k] || '–', DM.LAND_PTS[k] || '–'])));

    const things = DM.MATERIALS.filter(m => m !== 'ossidiana').map(m => [cap(m), qty(m, DM.PER_POINT[m])])
      .concat([['Soldi', n(DM.MONEY_PER_POINT)], ['Bacca (qualsiasi)', '1 bacca'], ['Pozione', '2 punti ciascuna'], ['Bomba', '40 punti ciascuna'], ['Superbomba', '100 punti ciascuna']]);
    add('Trasporto', () =>
      art('Alcune truppe possono trasportare altre truppe e merci. La capacità di ciascun mezzo si misura in punti, secondo le tabelle seguenti.', 'Capacità') +
      table(['Mezzo', 'Punti truppa', 'Punti merci'], DM.TROOP_KEYS.split('').map(k => [T[k].name, DM.TROOP_CAP[k] || 0, DM.CARGO_CAP[k] || '–'])) +
      '<h4>Ingombro delle truppe</h4>' + table(['Truppa', 'Punti truppa'], Object.keys(DM.TROOP_VALUE).map(k => [T[k].name, n(DM.TROOP_VALUE[k])])) +
      '<h4>Ingombro delle merci (quantità corrispondente a 1 punto)</h4>' + table(['Merce', '1 punto'], things) +
      art('I punti sono sempre <b>interi</b> e ogni tipo di merce si arrotonda per eccesso: 20.000 soldi occupano 1 punto, 1,5 t di ferro ne occupano 2. Conviene quindi caricare quantità piene (30.000 soldi, 1 t di ferro e così via).', 'Arrotondamento') +
      art('Si sale su un mezzo che si trova entro 1 cm. Le truppe a bordo non si muovono e non sparano finché non scendono.', 'Salire e scendere') +
      art('Sulle navi si sale e si scende soltanto <b>all\'interno di un Porto del giocatore</b>; dal Porto si raggiunge la terraferma attraverso il molo.', 'Navi') +
      art('Quando un mezzo viene distrutto, scendono le truppe che trasportava e, in aggiunta, un Soldato (il conducente). In mare aperto queste truppe vanno perdute.', 'Mezzo distrutto') +
      art('La Nave Carro e l\'Aereo Carro non possono essere trasportati.', 'Limiti') +
      art('I soldi e i materiali non si trasferiscono da soli tra gli edifici: per spostarli occorre un mezzo, di norma il Carro. I soldi si caricano a multipli di 1.000, i materiali a peso intero.', 'Spostare soldi e materiali'));

    add('Soldi, Città e Capitale', () =>
      art('Città e Capitale producono una rendita periodica, secondo la tabella.', 'Rendita') +
      table(['Edificio', 'Rendita', 'Ogni'], [['Città', n(DM.INCOME.citta), '10 giri'], ['Capitale', n(DM.INCOME.cap), '10 giri']]) +
      art('La rendita si calcola dal giro di costruzione: una Città costruita all\'8° giro produce la prima rendita al 18°.', 'Decorrenza') +
      art('Una Città deve custodire almeno 5.000 soldi; in caso contrario è considerata un Accampamento e non produce rendita.', 'Fondo minimo') +
      art('L\'Accampamento serve esclusivamente a schierare truppe. Può essere trasformato in Città pagando la differenza di costo.', 'Accampamento') +
      art('<b>Capitale distrutta.</b> La Capitale si trasferisce automaticamente in una Città che custodisca almeno il 50% dei soldi del giocatore. Se nessuna Città soddisfa questa condizione, il giocatore può trasportarvi i soldi necessari (per esempio con il Carro) e scegliere la nuova Capitale, senza limiti di tempo, ma perde 10.000 soldi in ciascuno dei suoi turni. Il giocatore che resta senza Capitale e senza Città è eliminato.') +
      art('Quando un edificio viene distrutto, va perduto tutto ciò che contiene: soldi, materiali, bacche, pozioni e bombe. Le truppe al suo interno sopravvivono, salvo che siano colpite da una Bomba.', 'Edificio distrutto'));

    add('Edifici e armi', () =>
      table(['Edificio', 'Vita', 'Costo'], [['Capitale', n(DM.BUILDING_HP.cap), 'compresa nel kit'], ['Città', n(DM.BUILDING_HP.citta), cost('citta')],
        ['Accampamento', n(DM.BUILDING_HP.acc), cost('acc')], ['Porto', n(DM.BUILDING_HP.porto), cost('porto')], ['Aeroporto', n(DM.BUILDING_HP.aer), cost('aer')],
        ['Coltivazione', n(DM.BUILDING_HP.col), cost('col')], ['Miniera', n(DM.BUILDING_HP.min), cost('min')],
        ['Ponte liv. 1', n(DM.BRIDGE_HP[1]), cost('ponte1') + ' per pezzo (1 cm)'], ['Ponte liv. 2', n(DM.BRIDGE_HP[2]), cost('ponte2') + ' per pezzo (1 cm)'],
        ['Strada', '5.000', n(DM.ROAD_COST.m) + ' soldi + 2 t ferro + 100 kg oro per tratto (massimo 5 cm)']]) +
      art('Gli edifici si costruiscono nel proprio territorio, con una propria truppa entro 2 cm, e mai su mare, fiumi, laghi, Banchisa o Lavico. Città, Capitale e Accampamenti non si costruiscono in Giungla, Palude e Alta montagna. La Coltivazione si costruisce soltanto in Deserto, Giungla, Palude e Tundra, gli unici biomi che producono bacche.', 'Costruzione') +
      '<h4>Porti</h4>' +
      art('Le Navi partono da un Porto. Sui fiumi il Porto non è necessario se entro 1 cm si trova una Città del giocatore.', 'Funzione') +
      art('Il Porto si costruisce in acqua (mare, fiume o lago) con terra del giocatore entro 1 cm, oppure all\'interno di una Città distante non più di 0,2 cm dall\'acqua.', 'Costruzione del Porto') +
      '<h4>Aeroporti</h4>' +
      art('L\'Aeroporto consente il decollo e l\'atterraggio dell\'Aereo Carro e dà agli Elicotteri 2 cm aggiuntivi alla partenza. Può essere costruito anche all\'interno di una Città.', 'Funzione') +
      '<h4>Ponti</h4>' +
      art('I ponti si acquistano a <b>pezzi</b>; ogni pezzo corrisponde a 1 cm. Il ponte si posa indicando un punto di terra su ciascuna riva: copre l\'acqua compresa tra le rive e usa un pezzo per ogni centimetro, arrotondando per eccesso (un ponte di 0,7 cm usa 1 pezzo, uno di 1,3 cm ne usa 2). Occorrono una propria truppa entro 2 cm e almeno una riva nel proprio territorio.', 'Posa') +
      art('Attraversa fiumi e laghi, ma non il mare. I Carrarmati non vi transitano e le Navi non vi passano sotto.', 'Livello 1') +
      art('Le Navi vi passano sotto e i Carrarmati vi transitano. Sul mare può essere costruito solo se più corto di 2 cm. Se colpito da una Bomba, torna al livello 1.', 'Livello 2') +
      art('I ponti possono essere attaccati soltanto con Bombe, Superbombe e Navi.', 'Attacco ai ponti') +
      '<h4>Strade</h4>' +
      art('La strada collega due edifici del giocatore, oppure un edificio e l\'estremità di un proprio ponte. Ogni tratto misura al massimo 5 cm e si paga soltanto la parte su terraferma.', 'Tracciato') +
      art('Quando incontra l\'acqua la strada si interrompe; collegata a un ponte, il percorso prosegue sul ponte.', 'Acqua e ponti') +
      art('Le truppe che viaggiano su strada raddoppiano la velocità, ad eccezione di Navi, truppe aeree e Carro. Un viaggio può attraversare più edifici collegati tra loro.', 'Velocità') +
      art('Nei biomi in cui non si costruiscono città (Giungla, Palude, Alta montagna) la strada costa il doppio. Non si costruisce su Banchisa e Lavico.', 'Costo e limiti') +
      '<h4>Bombe e Superbombe</h4>' +
      table(['Arma', 'Danno', 'Gittata', 'Costo'], [['Bomba', n(DM.BOMB.bomba.dmg), '15 cm da Capitale o Città, 10 cm da un Accampamento', cost('bomba')], ['Superbomba', n(DM.BOMB.superbomba.dmg), '30 cm da Capitale o Città', cost('superbomba')]]) +
      art('La gittata si misura dall\'edificio in cui si trova l\'arma. Le Superbombe si lanciano soltanto da Capitale e Città.', 'Lancio') +
      art('Chi lancia sceglie il bersaglio, anche tra i propri edifici (per esempio per distruggere una propria Città prima che venga conquistata).', 'Bersaglio') +
      art('Danno ad area: colpisce tutte le truppe dell\'esercito bersaglio; se colpisce un edificio, colpisce anche tutto ciò che contiene, truppe comprese.', 'Effetto della Bomba') +
      art('Colpisce tutto ciò che si trova entro 0,5 cm dal punto d\'impatto e lascia un\'area radioattiva per 3 giri (cap. 12, «Area radioattiva»).', 'Effetto della Superbomba'));

    add('Miniere', () =>
      art('La miniera si costruisce con una propria truppa entro 2 cm e ad almeno ' + DM.MINE_GAP + ' cm da ogni altra miniera. Costa 5.000 soldi e la costruzione riesce sempre.', 'Costruzione') +
      art('Costruita la miniera, si tira un dado: il minerale estratto dipende dal bioma e dal risultato, secondo la tabella. Con il kit Maghi il minerale si sceglie direttamente (art. 2.2).', 'Minerale') +
      table(['Bioma', '1', '2', '3', '4', '5', '6'], Object.keys(DM.MINE_TABLE).map(b => [DM.BIOME_NAME[b], ...DM.MINE_TABLE[b].split(' ').map(cap)])) +
      art('La miniera produce subito una prima quantità e poi la stessa quantità ogni 5 giri, finché non viene distrutta o non esce dal territorio del proprietario.', 'Produzione') +
      table(['Materiale', 'Quantità'], DM.MATERIALS.map(m => [cap(m), qty(m, DM.QTY[m])])) +
      art('Un avversario entra in possesso di una miniera conquistandone il territorio oppure acquistandola dal proprietario.', 'Passaggio di proprietà'));

    add('Il Banco e gli scambi', () =>
      art('Il Banco acquista i materiali soltanto a multipli della quantità indicata. In ciascun turno si può vendere un solo tipo di materiale. Il ricavato resta nell\'edificio da cui provengono i materiali.', 'Vendita') +
      table(['Materiale', 'Quantità', 'Prezzo'], DM.MATERIALS.map(m => [cap(m), qty(m, DM.BANK[m][0]), n(DM.BANK[m][1])])) +
      art('Gli scambi tra giocatori sono sempre ammessi: le parti si incontrano in un Porto o in una Città e depongono materiali e soldi dove preferiscono.', 'Scambi tra giocatori') +
      art('Durante uno scambio, un\'eventuale tregua è concordata liberamente dai giocatori e si fonda sulla reciproca fiducia.', 'Tregua'));

    add('Territori e conquista', () =>
      art('Le truppe che si avvicinano a un territorio mai conquistato ne acquisiscono tutta la parte entro 2 cm, che resta al giocatore anche quando le truppe si allontanano.', 'Terre libere') +
      art('Per conquistare un territorio avversario, le truppe devono restare per 3 giri entro 2 cm, a condizione che nello stesso raggio non vi siano truppe nemiche.', 'Territori nemici') +
      art('Città, Capitali, miniere, coltivazioni e gli altri edifici compresi nell\'area conquistata passano al conquistatore con tutto il loro contenuto, bombe comprese, ad eccezione delle truppe avversarie.', 'Edifici conquistati') +
      art('Un giocatore può cedere una parte del proprio territorio a un altro giocatore, a nessuno, oppure a un nuovo giocatore che entra in partita in quel luogo con un proprio kit. Può cedere anche un singolo edificio.', 'Cessione'));

    const spRow = k => DM.TROOP_KEYS.split('').map(t => {
      const d = T[t];
      if (k === 'F') return d.kind === 'land' ? (t === 'C' ? '–' : 'ponte') : d.kind === 'sea' ? (d.river || '–') : d.air;
      if (d.kind === 'air') return d.air;
      if (d.kind === 'sea') return k === 'I' ? d.ice : '–';
      return d.land[k] !== undefined ? String(d.land[k]).replace('.', ',') : '–';
    });
    add('I biomi', () =>
      art('Ogni bioma modifica le caratteristiche delle truppe che vi si trovano, secondo le tabelle seguenti.', 'Effetti') +
      table(['Bioma', 'Effetti'], [['Pianura', 'nessuno'], ['Deserto', 'danno :1,5'], ['Giungla', 'danno x1,5; niente città'], ['Palude', 'niente città; il livello di umidità più alto'],
        ['Tundra', 'gittata x2, velocità :2'], ['Montagna', 'velocità :2; niente bacche'], ['Alta montagna', 'niente città, niente bacche; confina soltanto con la Montagna'], ['Fiume / lago', 'Soldati e Carrarmati lo attraversano con i ponti']]) +
      '<h4>Velocità nei biomi (cm per turno)</h4>' + table(['Bioma', ...DM.TROOP_KEYS.split('').map(k => T[k].name)], BIO_LAND.split('').concat('F').map(b => [DM.BIOME_NAME[b], ...spRow(b)])) +
      '<h4>Danno nei biomi</h4>' + table(['Bioma', ...Object.keys(DM.BIOME_DMG).map(k => T[k].name)], ['D', 'G'].map(b => [DM.BIOME_NAME[b], ...Object.keys(DM.BIOME_DMG).map(k => n(DM.BIOME_DMG[k][b]))])) +
      box('imp', 'Nella Tundra la gittata raddoppia per Soldato, Elicottero e Carrarmato. Le truppe marine e aeree non subiscono le riduzioni di velocità del terreno. Nave Carro e Aereo Carro modificano le proprie caratteristiche soltanto per effetto delle bacche.') +
      '<h4>Vulcanico e Lavico</h4>' +
      art('Ogni 10 giri si tira un dado per ciascun vulcano: con 1, il terreno entro 1 cm dal Vulcanico diventa Lavico per 3 giri e le truppe e gli edifici presenti vengono distrutti. La pozione Ignifuga protegge un edificio.', 'Eruzioni') +
      art('Velocità :2. Le truppe che vi si trovano subiscono bruciature per 3 turni (Soldato 20, Carrarmato 500, Carro 500 per turno); le bruciature non si sommano. Le truppe aeree non possono atterrarvi. Esistono zone di lava perenne.', 'Lavico') +
      art('Vulcanico e Lavico non modificano gittata e danno.', 'Gittata e danno') +
      '<h4>Glaciale e Banchisa</h4>' +
      art('Non produce bacche e non modifica velocità, gittata e danno.', 'Glaciale') +
      art('Ghiaccio su mare, laghi e fiumi. Velocità :2 per le truppe di terra e di mare; la Nave procede a 1,5 cm e la Nave Carro a 6 cm. Le truppe aeree non vi atterrano e non vi si costruisce nulla, nemmeno strade.', 'Banchisa') +
      '<h4>Area radioattiva</h4>' +
      art('È generata dalla Superbomba e dura 3 giri, anche sul mare. Dimezza la velocità dopo l\'effetto del bioma, arrotondando per eccesso al millimetro.', 'Area radioattiva') +
      box('ex', 'Un Soldato nel Deserto procede a 0,3 cm; nell\'area radioattiva la sua velocità diventa 0,3 : 2 = 0,15, arrotondata a 0,2 cm.'));

    add('Le bacche', () =>
      art('Le bacche crescono nelle Coltivazioni, una ogni 5 giri, e sono del bioma in cui si trova la Coltivazione. Pianura, Montagna, Alta montagna, Vulcanico, Glaciale e Banchisa non producono bacche.', 'Produzione') +
      art('Si lanciano da Capitale, Città e Accampamenti, con la gittata delle Bombe (15 cm; 10 cm dagli Accampamenti), su qualsiasi truppa, propria o avversaria, a scelta di chi lancia. L\'effetto dura 3 giri e si estende a tutto l\'esercito colpito.', 'Lancio') +
      art('Si può lanciare al massimo una bacca per turno; il lancio non conta come sparo.', 'Limite') +
      table(['Bacca', 'Effetto per 3 giri'], [['Deserto', 'danno :1,5'], ['Giungla', 'danno x1,5'], ['Palude', 'velocità :5'], ['Tundra', 'gittata x2']]) +
      art('Se la truppa si trova nel bioma corrispondente alla bacca, il primo effetto si applica normalmente e il secondo aggiunge o sottrae la quantità fissa indicata nella tabella seguente. Gli effetti delle bacche di Deserto e di Giungla si annullano a vicenda.', 'Effetti cumulati') +
      table(['Truppa', 'Deserto (danno)', 'Giungla (danno)', 'Tundra (gittata)', 'Palude (velocità)'], DM.TROOP_KEYS.split('').map(k => [T[k].name, ...DM.BERRY_STACK[k].map(v => v ? (v > 0 ? '+' : '') + String(v).replace('.', ',') : '–')])));

    const PZ = { poz_stipendio: 'Tre truppe o eserciti a scelta infliggono danni doppi per 1 turno.', poz_velocita: 'Una truppa o un esercito guadagna 1 cm di movimento; nei biomi che riducono la velocità, la velocità raddoppia (dopo la riduzione).',
      poz_curacitta: 'Ripristina 1.000 punti vita a un Accampamento, 2.000 a una Città, 4.000 a una Capitale.', poz_concime: 'Riduce di 2 turni l\'attesa di una Coltivazione.', poz_miglioracitta: 'Aumenta di 10.000 la rendita e di 5.000 la vita di una Città.',
      poz_curatruppe: 'Ripristina il 50% della vita di una truppa, ovunque si trovi.', poz_ignifuga: 'Protegge un edificio dalle eruzioni finché non viene distrutto.' };
    add('Le pozioni', () =>
      art('Le pozioni si acquistano negli edifici del giocatore e si usano dall\'edificio in cui sono custodite.', 'Uso') +
      table(['Pozione', 'Costo', 'Effetto'], Object.keys(PZ).map(k => [DM.POTIONS[k], cost(k), PZ[k]])));

    add('Consigli di gioco', () => '<p class="note">I consigli seguenti non sono regole, ma suggerimenti.</p>' +
      art('Se una propria Città sta per essere conquistata, la si può distruggere con una Bomba prima che passi all\'avversario, oppure evacuarla caricando soldi e materiali su un Carro.', 'Città in pericolo') +
      art('Sui fiumi il Porto è spesso superfluo: una Nave può partire da un fiume se entro 1 cm si trova una propria Città.', 'Fiumi') +
      art('Per assegnare a caso i colpi sul tavolo, si mettono in un bicchiere le perline dell\'esercito colpito, una per truppa, e per ogni colpo se ne estrae una senza guardare: è la truppa colpita. La perlina si rimette nel bicchiere, perché una truppa può essere colpita più volte, e si toglie soltanto quando la truppa muore. Con poche truppe basta un dado: si numerano le truppe e si tira, ripetendo il lancio se il numero non corrisponde ad alcuna truppa.', 'Colpi a caso sul tavolo'));

    add('Glossario', () => table(['Termine', 'Significato'], [
      ['Truppa', 'Singola unità: Soldato, Nave, Elicottero, Carrarmato, Carro, Nave Carro o Aereo Carro.'], ['Esercito', 'Gruppo di truppe che si muovono e attaccano insieme.'],
      ['Flotta', 'Esercito che comprende almeno una Nave o una Nave Carro.'], ['Kit', 'La dotazione iniziale scelta da ciascun giocatore.'], ['Riserva', 'Le truppe e gli edifici posseduti ma non ancora collocati sulla mappa.'],
      ['Schieramento', 'La collocazione di una truppa sulla mappa, presso la Capitale, una Città, un Accampamento, un Porto o un Aeroporto.'], ['Banco', 'L\'acquirente dei materiali.'],
      ['Gittata', 'La distanza, in centimetri, entro cui una truppa o un\'arma può colpire.'], ['Bonus / malus', 'Aumento o riduzione di velocità, danno o gittata.'], ['Territorio', 'L\'area controllata da un giocatore.'],
      ['Turno', 'La fase di gioco di un singolo giocatore.'], ['Giro', 'L\'insieme dei turni di tutti i giocatori.']]));

    return '<nav class="toc"><b>Indice</b><ol>' + ch.map((c, i) => `<li><a href="#reg${i + 1}">${c.title}</a></li>`).join('') + '</ol></nav>' +
      ch.map((c, i) => `<section class="rule" id="reg${i + 1}"><h3>${i + 1}. ${c.title}</h3>${c.html}</section>`).join('');
  };
})(globalThis.DM = globalThis.DM || {});
