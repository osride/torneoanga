import { useState, useMemo, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import 'reactflow/dist/style.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { motion, Variants } from 'framer-motion';

interface Match {
  id: string;
  p1: string;
  p2: string;
  winner: string | null;
  round: number;
  parents: string[];
}

const TrophyIcon = () => (
  <motion.img
    src="https://cdn-icons-png.flaticon.com/512/2583/2583346.png"
    alt="Trophy"
    className="w-16 h-16 mx-auto mb-2 drop-shadow-lg"
    initial={{ scale: 0, rotate: -15 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
  />
);

const fireworkVariants: Variants = {
  hidden: { opacity: 0, scale: 0 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    x: Math.cos(i * (Math.PI * 2 / 8)) * 25,
    y: Math.sin(i * (Math.PI * 2 / 8)) * 25,
    transition: {
      delay: i * 0.05,
      repeat: Infinity,
      repeatType: 'reverse',
      duration: 0.8,
      ease: 'easeInOut',
    },
  }),
};

export default function App() {
  const [players, setPlayers] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [started, setStarted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);

  const addPlayer = () => {
    if (input.trim()) {
      setPlayers((prev) => [...prev, input.trim()]);
      setInput('');
    }
  };

  const shufflePlayers = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    setPlayers(shuffled);
  };

  const confirmReset = () => setShowConfirmReset(true);
  const cancelReset = () => setShowConfirmReset(false);
  const resetTournament = () => {
    setPlayers([]);
    setInput('');
    setMatches([]);
    setStarted(false);
    setShowConfirmReset(false);
  };

  const generateInitialMatches = (playersList: string[]): Match[] => {
    const currentPlayers = [...playersList];
    while (currentPlayers.length % 2 !== 0) currentPlayers.push('Libre');
    const matches: Match[] = [];
    for (let i = 0; i < currentPlayers.length; i += 2) {
      matches.push({
        id: uuidv4(),
        p1: currentPlayers[i],
        p2: currentPlayers[i + 1],
        winner: null,
        round: 0,
        parents: [],
      });
    }
    return matches;
  };

  const generateNextRound = (currentMatches: Match[]): Match[] => {
    const nextRound: Match[] = [];
    for (let i = 0; i < currentMatches.length; i += 2) {
      const m1 = currentMatches[i];
      const m2 = currentMatches[i + 1];
      nextRound.push({
        id: uuidv4(),
        p1: m1?.winner || 'Pendiente',
        p2: m2?.winner || 'Pendiente',
        winner: null,
        round: m1.round + 1,
        parents: [m1.id, m2?.id || ''],
      });
    }
    return nextRound;
  };

  const handleLibreChange = (matchId: string, value: string, playerNumber: 1 | 2) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, [playerNumber === 1 ? 'p1' : 'p2']: value } : m
      )
    );
  };

  const startTournament = () => {
    const initialMatches = generateInitialMatches(players);
    setMatches(initialMatches);
    setStarted(true);
  };

  const handleWinner = (matchId: string, winner: string) => {
    let updated = matches.map((m) => (m.id === matchId ? { ...m, winner } : m));
    const currentMatch = updated.find((m) => m.id === matchId);
    if (!currentMatch) return;

    const currentRoundMatches = updated.filter((m) => m.round === currentMatch.round);
    const allWinnersSelected = currentRoundMatches.every((m) => m.winner);
    const nextRoundExists = updated.some((m) => m.round === currentMatch.round + 1);

    const isLastMatch = currentRoundMatches.length === 1 && !nextRoundExists;

    if (allWinnersSelected && !nextRoundExists && !isLastMatch) {
      const nextRoundMatches = generateNextRound(currentRoundMatches);
      updated = [...updated, ...nextRoundMatches];
    }

    setMatches(updated);
  };

  const nodes: Node[] = useMemo(() => {
    const nodesArray: Node[] = [];
    const spacingX = 250;
    const spacingY = 160;
    const rounds = Math.max(...matches.map((m) => m.round), 0);

    for (let round = 0; round <= rounds; round++) {
      const roundMatches = matches.filter((m) => m.round === round);
      const offsetY = (spacingY * roundMatches.length) / -2;
      roundMatches.forEach((match, idx) => {
        const winnerSelected = !!match.winner;
        nodesArray.push({
          id: match.id,
          position: {
            x: round * spacingX,
            y: idx * spacingY + offsetY,
          },
          data: {
            label: (
              <div
                className={`flex flex-col gap-2 text-sm bg-white border rounded-xl p-3 min-w-[160px] ${
                  winnerSelected ? 'border-green-500 shadow-green-300 shadow-lg' : 'shadow-md'
                }`}
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={match.winner === match.p1}
                    onChange={() => handleWinner(match.id, match.p1 ?? '')}
                  />
                  {exporting ? (
                    <span className="text-xs font-medium">{match.p1 ?? ''}</span>
                  ) : (
                    <input
                      className="border px-1 py-0.5 text-xs rounded w-full"
                      value={match.p1 ?? ''}
                      onChange={(e) => handleLibreChange(match.id, e.target.value, 1)}
                    />
                  )}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={match.winner === match.p2}
                    onChange={() => handleWinner(match.id, match.p2 ?? '')}
                  />
                  {exporting ? (
                    <span className="text-xs font-medium">{match.p2 ?? ''}</span>
                  ) : (
                    <input
                      className="border px-1 py-0.5 text-xs rounded w-full"
                      value={match.p2 ?? ''}
                      onChange={(e) => handleLibreChange(match.id, e.target.value, 2)}
                    />
                  )}
                </label>
                {match.winner && (
                  <div className="text-green-600 font-semibold text-center pt-1 border-t mt-2">
                    Ganador: {match.winner}
                  </div>
                )}
              </div>
            ),
          },
          type: 'default',
        });
      });
    }

    const finalRound = Math.max(...matches.map((m) => m.round), 0);
    const finalMatches = matches.filter((m) => m.round === finalRound);
    const finalMatch = finalMatches.length === 1 ? finalMatches[0] : null;
    const noMoreRounds = !matches.some((m) => m.round > finalRound);
    const allWinnersSelected = matches.length > 0 && matches.every((m) => !!m.winner);

    if (finalMatch && finalMatch.winner && noMoreRounds && allWinnersSelected) {
      const maxX = Math.max(...nodesArray.map((n) => n.position.x));
      const rightMostNodes = nodesArray.filter((n) => n.position.x === maxX);
      const avgY = rightMostNodes.reduce((sum, n) => sum + n.position.y, 0) / rightMostNodes.length;

      nodesArray.push({
        id: 'winner-node',
        position: { x: maxX + spacingX, y: avgY },
        data: {
          label: (
            <motion.div
              className="bg-yellow-100 text-blue-700 text-center p-4 rounded-xl font-bold shadow relative overflow-visible border border-yellow-400"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.3 }}
            >
              <TrophyIcon />
              GANADOR: {finalMatch.winner}
              <div className="absolute inset-0 pointer-events-none overflow-visible">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    custom={i}
                    variants={fireworkVariants}
                    initial="hidden"
                    animate="visible"
                    className="w-3 h-3 rounded-full bg-yellow-400 absolute top-1/2 left-1/2"
                    style={{ originX: 0.5, originY: 0.5 }}
                  />
                ))}
              </div>
            </motion.div>
          ),
        },
        type: 'default',
        draggable: false,
      });
    }

    return nodesArray;
  }, [matches, exporting]);

  const edges: Edge[] = useMemo(() => {
    const allEdges: Edge[] = [];
    matches.forEach((match) => {
      match.parents.forEach((parentId) => {
        if (parentId)
          allEdges.push({
            id: `e-${parentId}-${match.id}`,
            source: parentId,
            target: match.id,
            type: 'smoothstep',
            animated: true,
          });
      });
    });

    const finalRound = Math.max(...matches.map((m) => m.round), 0);
    const finalMatches = matches.filter((m) => m.round === finalRound);
    const finalMatch = finalMatches.length === 1 ? finalMatches[0] : null;
    const noMoreRounds = !matches.some((m) => m.round > finalRound);
    const allWinnersSelected = matches.length > 0 && matches.every((m) => !!m.winner);

    if (finalMatch && finalMatch.winner && noMoreRounds && allWinnersSelected) {
      allEdges.push({
        id: 'e-final-winner',
        source: finalMatch.id,
        target: 'winner-node',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 3 },
      });
    }

    return allEdges;
  }, [matches]);

  const exportPDF = async () => {

  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    alert("La exportación a PDF funciona mejor desde un computador. Intenta desde un navegador de escritorio para mejores resultados.");
    return;
  }
  
  if (!flowRef.current) return;
  setExporting(true);
  await new Promise((resolve) => setTimeout(resolve, 200)); // espera para estilos

  // Captura la parte visual del torneo
  const canvas = await html2canvas(flowRef.current, {
    useCORS: true,
    backgroundColor: null,
    scale: 2,
    foreignObjectRendering: true, // <---
  });

  // Crear canvas para fondo + título + contenido
  const pdfWidth = canvas.width;
  const pdfHeight = canvas.height + 100; // espacio para título y logo arriba
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = pdfWidth;
  finalCanvas.height = pdfHeight;
  const ctx = finalCanvas.getContext('2d');
  if (!ctx) return;

  // Cargar la imagen de fondo con Promise
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // para evitar problemas CORS si es necesario
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
    });

  let bgImg: HTMLImageElement | null = null;
  try {
    //bgImg = await loadImage('../assets/img/angaLogo.jpg'); // Ajusta ruta si hace falta
    bgImg = await loadImage('/angaLogo.jpg'); // Ajusta ruta si hace falta
  } catch {
    console.warn('No se pudo cargar la imagen de fondo.');
  }

  // Dibujar imagen fondo (si cargó)
  if (bgImg) {
    ctx.globalAlpha = 0.1; // baja opacidad para fondo tenue
    ctx.drawImage(bgImg, 0, 0, pdfWidth, pdfHeight);
    ctx.globalAlpha = 1;
  }

  // Dibujar título arriba, centrado
  ctx.fillStyle = '#1e40af'; // azul oscuro
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('JOGOS DE INVIERNO ANGÁ 2025', pdfWidth / 2, 50);

  // Dibujar captura del torneo debajo del título
  ctx.drawImage(canvas, 0, 100, pdfWidth, canvas.height);

  // Crear PDF con jsPDF, tamaño relativo
  const imgData = finalCanvas.toDataURL('image/png');
  const pdf = new jsPDF('landscape', undefined, [pdfWidth * 0.75, pdfHeight * 0.75]);
  const imgProps = pdf.getImageProperties(imgData);
  const pdfPageWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = (imgProps.height * pdfPageWidth) / imgProps.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfPageWidth, pdfPageHeight);
  pdf.save('torneo.pdf');
  setExporting(false);
};

const exportPNG = async () => {
  if (!flowRef.current) return;
  setExporting(true);
  await new Promise((r) => setTimeout(r, 200)); // pequeña espera para asegurar render

  const canvas = await html2canvas(flowRef.current, {
    useCORS: true,
    backgroundColor: '#ffffff',
    scale: 2,
    foreignObjectRendering: true,
  });

  const imgData = canvas.toDataURL('image/png');

  // Crear enlace de descarga
  const link = document.createElement('a');
  link.href = imgData;
  link.download = 'torneo.png';
  link.click();

  setExporting(false);
};



  return (
    <div className="min-h-screen relative bg-gray-50 overflow-hidden bg-custom">
      {!started ? (
        <div className="flex flex-col gap-4 p-4 max-w-xl mx-auto relative z-10">
          <h1 className="text-center text-3xl font-bold text-blue-600 drop-shadow-lg">JOGOS DE INVIERNO ANGÁ 2025</h1>
          <h1 className="text-center text-3xl font-bold text-blue-600 drop-shadow-lg">INGRESO DE JOGADORES</h1>
          <br />
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-2 py-1"
              placeholder="Nombre del jugador"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            />
            <button className="bg-blue-500 text-white px-3 py-1 rounded" onClick={addPlayer}>
              Agregar
            </button>
          </div>
          <ul className="list-disc pl-5 space-y-1 font-bold text-green-800 drop-shadow-md">
            {players.map((p, i) => (
              <li key={i} className="text-2xl">
                {p}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button className="bg-yellow-600 text-white px-4 py-2 rounded" onClick={shufflePlayers}>
              Aleatorizar jugadores
            </button>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
              onClick={startTournament}
              disabled={players.length < 2}
            >
              Iniciar Torneo
            </button>
            <button
              className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
              onClick={confirmReset}
            >
              Reiniciar
            </button>
          </div>
        </div>
      ) : (
        <div className="h-[90vh] relative z-10 flex flex-col">
          {/* Título arriba del torneo igual que en inscripción */}
          <h1 className="text-center text-3xl font-bold text-blue-600 drop-shadow-lg py-4 select-none">
            JOGOS DE INVIERNO ANGÁ 2025
          </h1>
          <div className="flex-1 relative" ref={flowRef} style={{
            backgroundImage: "url('/angaLogo.jpg')",
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
          }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
              snapToGrid
              snapGrid={[15, 15]}
            >
              <MiniMap
                nodeStrokeColor={(n) => (n.selected ? '#ff0072' : '#0041d0')}
                nodeColor={(n) => (n.selected ? '#ffaacc' : '#fff')}
              />
              <Controls />
              <Background />
            </ReactFlow>
          </div>
          <div className="absolute right-4 top-4 z-50 flex gap-2">
            <button
              //onClick={exportPDF}
              onClick={exportPNG}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow"
            >
              Exportar a PDF
            </button>
            <button
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow"
              onClick={confirmReset}
            >
              Reiniciar
            </button>
          </div>
          {/* Confirmación modal */}
          {showConfirmReset && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg flex flex-col gap-4"
              >
                <h2 className="text-xl font-bold text-center">Confirmar reinicio</h2>
                <p className="text-center">¿Estás seguro que quieres reiniciar el torneo? Se perderán los datos actuales.</p>
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    onClick={resetTournament}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Sí, reiniciar
                  </button>
                  <button
                    onClick={cancelReset}
                    className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
