/**
 * Tests für src/services/shiftUtils.ts (echter Produktivcode, keine Kopie).
 * Ausführung: node test/shiftUtils.test.js  (Node >= 22.18 / 24 mit Type-Stripping)
 */
import {
  mergeShiftsWithTombstones,
  sameShiftSet,
  sameDeletedMap,
  checkRestTime,
  annualLimitStatus,
  shiftsToCsv,
  shiftsToIcs,
  getShiftSpan
} from '../src/services/shiftUtils.ts';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function eq(actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`Erwartet: ${b}\n     erhalten: ${a}`);
}
function truthy(v, msg = 'Erwartet truthy') {
  if (!v) throw new Error(msg);
}

const shift = (datum, kommen, gehen, netto, updatedAt, extra = {}) => ({
  datum, kommen, gehen, pauseMinuten: 0, nettoStunden: netto, updatedAt, ...extra
});

// ---------- MERGE ----------
test('Merge: offline erfasste lokale Schicht bleibt erhalten', () => {
  const local = [shift('2026-10-01', '08:00', '16:00', 8, '2026-10-01T20:00:00Z')];
  const res = mergeShiftsWithTombstones(local, [], {}, {});
  eq(res.shifts.map(s => s.datum), ['2026-10-01']);
});

test('Merge: neuere Version gewinnt pro Tag, bei Gleichstand die Cloud', () => {
  const l = [shift('2026-10-01', '08:00', '16:00', 8, '2026-10-01T10:00:00Z')];
  const c = [shift('2026-10-01', '09:00', '17:00', 8, '2026-10-01T12:00:00Z')];
  eq(mergeShiftsWithTombstones(l, c).shifts[0].kommen, '09:00');
  const l2 = [shift('2026-10-01', '08:00', '16:00', 8, '2026-10-01T13:00:00Z')];
  eq(mergeShiftsWithTombstones(l2, c).shifts[0].kommen, '08:00');
  const same = [shift('2026-10-01', '10:00', '18:00', 8, '2026-10-01T12:00:00Z')];
  eq(mergeShiftsWithTombstones(same, c).shifts[0].kommen, '09:00');
});

test('Merge: in der Cloud gelöschte Schicht (Tombstone) erwacht nicht wieder', () => {
  const local = [shift('2026-10-02', '08:00', '16:00', 8, '2026-10-02T08:00:00Z')];
  const cloudDeleted = { '2026-10-02': { datum: '2026-10-02', deletedAt: '2026-10-02T09:00:00Z' } };
  const res = mergeShiftsWithTombstones(local, [], {}, cloudDeleted);
  eq(res.shifts, []);
  eq(Object.keys(res.deleted), ['2026-10-02']);
});

test('Merge: nach dem Löschen neu angelegte Schicht überlebt den Tombstone', () => {
  const local = [shift('2026-10-02', '08:00', '16:00', 8, '2026-10-02T10:00:00Z')];
  const cloudDeleted = { '2026-10-02': { datum: '2026-10-02', deletedAt: '2026-10-02T09:00:00Z' } };
  eq(mergeShiftsWithTombstones(local, [], {}, cloudDeleted).shifts.length, 1);
});

test('Merge: lokaler Tombstone entfernt Cloud-Schicht, jüngerer Tombstone gewinnt', () => {
  const cloud = [shift('2026-10-03', '08:00', '16:00', 8, '2026-10-03T08:00:00Z')];
  const localDel = { '2026-10-03': { datum: '2026-10-03', deletedAt: '2026-10-03T12:00:00Z' } };
  const cloudDel = { '2026-10-03': { datum: '2026-10-03', deletedAt: '2026-10-03T10:00:00Z' } };
  const res = mergeShiftsWithTombstones([], cloud, localDel, cloudDel);
  eq(res.shifts, []);
  eq(res.deleted['2026-10-03'].deletedAt, '2026-10-03T12:00:00Z');
});

test('Merge: Ergebnis ist nach Datum sortiert, Eingaben bleiben unverändert', () => {
  const l = [shift('2026-10-05', '08:00', '16:00', 8, 'x')];
  const c = [shift('2026-10-01', '08:00', '16:00', 8, 'x')];
  const lCopy = JSON.stringify(l);
  eq(mergeShiftsWithTombstones(l, c).shifts.map(s => s.datum), ['2026-10-01', '2026-10-05']);
  eq(JSON.stringify(l), lCopy);
});

test('Merge: ungültige Einträge werden übersprungen, undefined-Parameter sind erlaubt', () => {
  const res = mergeShiftsWithTombstones([null, { kommen: '1' }], undefined, undefined, undefined);
  eq(res.shifts, []);
});

test('sameShiftSet / sameDeletedMap erkennen Unterschiede', () => {
  const a = [shift('2026-10-01', '08:00', '16:00', 8, 't1')];
  truthy(sameShiftSet(a, [{ ...a[0] }]));
  truthy(!sameShiftSet(a, [{ ...a[0], kommen: '09:00' }]));
  truthy(!sameShiftSet(a, []));
  truthy(sameDeletedMap({ d: { datum: 'd', deletedAt: '1' } }, { d: { datum: 'd', deletedAt: '1' } }));
  truthy(!sameDeletedMap({ d: { datum: 'd', deletedAt: '1' } }, { d: { datum: 'd', deletedAt: '2' } }));
});

// ---------- RUHEZEIT ----------
test('Ruhezeit: Nachtdienst gefolgt von Frühdienst am nächsten Tag wird gewarnt', () => {
  const night = shift('2026-10-10', '20:00', '08:00', 11, 'x'); // endet 11.10. 08:00
  const early = shift('2026-10-11', '10:00', '18:00', 8, 'x'); // nur 2 h Ruhe
  const msg = checkRestTime([night], early);
  truthy(msg && msg.includes('2 h 00 min'), `Meldung: ${msg}`);
});

test('Ruhezeit: Warnung funktioniert auch in Gegenrichtung (neuer Dienst davor)', () => {
  const next = shift('2026-10-11', '06:00', '14:00', 8, 'x');
  const neu = shift('2026-10-10', '14:00', '22:00', 8, 'x'); // 8 h Ruhe
  const msg = checkRestTime([next], neu);
  truthy(msg && msg.includes('vor dem Dienst vom 11.10.2026'), `Meldung: ${msg}`);
});

test('Ruhezeit: genau 11 h ist in Ordnung, 0-h-Einträge und gleicher Tag werden ignoriert', () => {
  const a = shift('2026-10-10', '08:00', '16:00', 8, 'x'); // Ende 16:00
  const b = shift('2026-10-11', '03:00', '11:00', 8, 'x'); // Start 03:00 = 11 h später
  eq(checkRestTime([a], b), null);
  eq(checkRestTime([shift('2026-10-10', '08:00', '16:00', 0, 'x')], shift('2026-10-10', '17:00', '18:00', 1, 'x')), null);
  eq(checkRestTime([a], shift('2026-10-10', '08:00', '17:00', 9, 'x')), null);
});

test('Ruhezeit: Überschneidung wird erkannt; ungültige Zeiten führen nicht zu Fehlern', () => {
  const a = shift('2026-10-10', '20:00', '08:00', 11, 'x');
  const b = shift('2026-10-11', '06:00', '14:00', 8, 'x');
  truthy(checkRestTime([a], b).includes('Überschneidung'));
  eq(checkRestTime([a], shift('2026-10-12', '', '', 0, 'x')), null);
  eq(checkRestTime([a], shift('2026-10-12', '25:00', '08:00', 5, 'x')), null);
  eq(getShiftSpan(shift('kaputt', '08:00', '16:00', 8)), null);
});

test('Ruhezeit: Sommerzeitumstellung verfälscht die Berechnung nicht', () => {
  // 25.10.2026 ist Ende der Sommerzeit: 20:00-08:00 dauert 12 h Uhrzeit, wir rechnen kalendarisch
  const s = getShiftSpan(shift('2026-10-24', '20:00', '08:00', 11));
  eq((s.end - s.start) / 60, 12);
});

// ---------- JAHRESGRENZE ----------
test('Jahresgrenze: ok / warn ab 90 % / over über 100 % / ungültiges Limit', () => {
  eq(annualLimitStatus(1000, 7230).level, 'ok');
  eq(annualLimitStatus(6507, 7230).level, 'warn');
  eq(annualLimitStatus(7230, 7230).level, 'warn');
  eq(annualLimitStatus(7230.01, 7230).level, 'over');
  eq(annualLimitStatus(500, 0).level, 'ok');
});

// ---------- CSV ----------
test('CSV: BOM, Semikolon, Komma-Dezimal, Summe und nur der gewählte Monat', () => {
  const csv = shiftsToCsv(
    [
      shift('2026-10-05', '08:00', '16:30', 8, 'x', { pauseMinuten: 30, schichtTyp: 'Frühdienst' }),
      shift('2026-10-04', '07:30', '12:00', 4.5, 'x'),
      shift('2026-09-30', '08:00', '16:00', 8, 'x')
    ],
    '2026-10'
  );
  truthy(csv.startsWith('\uFEFFDatum;Wochentag'));
  const lines = csv.trim().split('\r\n');
  eq(lines.length, 4); // Kopf + 2 Schichten + Summe
  truthy(lines[1].startsWith('04.10.2026;So;07:30;12:00;0;4,50'));
  truthy(lines[2].startsWith('05.10.2026;Mo;08:00;16:30;30;8,00;Frühdienst'));
  eq(lines[3].split(';')[5], '12,50');
});

test('CSV: Sonderzeichen werden maskiert und Formel-Injection entschärft', () => {
  const csv = shiftsToCsv(
    [shift('2026-10-05', '08:00', '16:00', 8, 'x', { notiz: '=HYPERLINK("evil");mehr' })],
    '2026-10'
  );
  truthy(csv.includes(`"'=HYPERLINK(""evil"");mehr"`), csv);
});

test('CSV: leerer Monat liefert nur Kopf und Summe 0,00', () => {
  const lines = shiftsToCsv([], '2026-10').trim().split('\r\n');
  eq(lines.length, 2);
  eq(lines[1].split(';')[5], '0,00');
});

// ---------- iCAL ----------
test('iCal: Termin mit korrekter Start-/Endzeit, Nachtdienst endet am Folgetag', () => {
  const ics = shiftsToIcs(
    [shift('2026-10-10', '20:00', '08:00', 11, 'x', { schichtTyp: 'Nachtdienst', notiz: 'Test; mit, Zeichen' })],
    new Date('2026-10-28T10:00:00Z')
  );
  truthy(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  truthy(ics.includes('DTSTART:20261010T200000\r\n'));
  truthy(ics.includes('DTEND:20261011T080000\r\n'));
  truthy(ics.includes('UID:2026-10-10@zeiterfassung'));
  truthy(ics.includes('DTSTAMP:20261028T100000Z'));
  truthy(ics.includes('Test\\; mit\\, Zeichen'));
  truthy(ics.endsWith('END:VCALENDAR\r\n'));
});

test('iCal: 0-h-Schichten werden nicht exportiert, lange Zeilen werden gefaltet (<= 75 Zeichen)', () => {
  const lang = 'x'.repeat(200);
  const ics = shiftsToIcs(
    [shift('2026-10-10', '08:00', '16:00', 8, 'x', { notiz: lang }), shift('2026-10-11', '08:00', '08:00', 0, 'x')],
    new Date('2026-10-28T10:00:00Z')
  );
  eq((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  truthy(ics.split('\r\n').every(l => Array.from(l).length <= 75));
});

let passed = 0;
let failed = 0;
console.log('\n🧪 Tests für shiftUtils (Merge, Ruhezeit, Limit, CSV, iCal)...');
for (const t of tests) {
  try {
    t.fn();
    console.log(`  ✓ ${t.name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${t.name}\n    ${e.message}`);
    failed++;
  }
}
console.log(`\nErgebnis: ${passed} bestanden, ${failed} fehlgeschlagen von ${tests.length} Tests.\n`);
if (failed > 0) process.exit(1);
