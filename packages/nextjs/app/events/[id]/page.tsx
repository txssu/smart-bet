"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { parseEther } from "ethers/lib/utils";
import { ContractFunctionExecutionError, ContractFunctionRevertedError } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";

type EventData = {
  eventId: bigint;
  name: string;
  numCandidates: number;
  isOpen: boolean;
  resolved: boolean;
  winner?: number;
  totalBetsOnCandidate: bigint[];
  creator: string;
};

function handleError(err: ContractFunctionExecutionError) {
  const cause = err.cause;
  if (cause instanceof ContractFunctionRevertedError) {
    alert(`Transaction reverted: ${cause.reason}`);
  } else {
    alert(`Transaction failed: ${err.message}`);
  }
}

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id ? BigInt(params.id as string) : null;

  const { address: connectedAddress } = useAccount();
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [betCandidate, setBetCandidate] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<string>("0.01");
  const [resolveCandidate, setResolveCandidate] = useState<number>(0);

  const { data: walletClient } = useWalletClient();
  const { data: contract, isLoading: isLoading } = useScaffoldContract({ contractName: "Betting", walletClient });

  const loadEventInfo = async () => {
    const eventData = await contract?.read.events([eventId!]);
    if (!eventData) return;

    const [creator, eventName, numCandidates, isOpen, resolved, winner] = eventData;

    const totalBets = (await contract?.read.getEventTotalBetsOnCandidate([eventId!])) as bigint[];

    return {
      eventId: eventId,
      name: eventName,
      numCandidates,
      isOpen,
      resolved,
      winner: resolved ? winner : undefined,
      totalBetsOnCandidate: totalBets,
      creator: creator,
    } as EventData;
  };

  const updateEvent = async () => {
    const updated = await loadEventInfo();
    if (updated === undefined) return;
    setSelectedEvent(updated);
  };

  const placeBet = async () => {
    const amount = parseEther(betAmount).toBigInt();
    await contract?.write.placeBet([eventId!, betCandidate], { value: amount }).catch(handleError);
    updateEvent();
  };

  const closeBetting = async () => {
    await contract?.write.closeBetting([eventId!], {}).catch(handleError);
    updateEvent();
  };

  const resolveEvent = async () => {
    await contract?.write.resolveEvent([eventId!, resolveCandidate], {}).catch(handleError);
    updateEvent();
  };

  const claimWinnings = async () => {
    await contract?.write.claimWinnings([eventId!], {}).catch(handleError);
    updateEvent();
  };

  useEffect(() => {
    if (isLoading) return;

    updateEvent();
    const interval = setInterval(() => {
      updateEvent();
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (contract === undefined) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-8">
      <h2 className="text-xl font-semibold mb-2">Selected Event: #{eventId!.toString()}</h2>

      {selectedEvent && (
        <>
          <p>Name: {selectedEvent.name}</p>
          <p>Candidates: {selectedEvent.numCandidates}</p>
          <p>Open: {selectedEvent.isOpen ? "Yes" : "No"}</p>
          <p>Resolved: {selectedEvent.resolved ? `Yes (winner: ${selectedEvent.winner})` : "No"}</p>
          <p>
            Total bets by candidate:{" "}
            {selectedEvent.totalBetsOnCandidate.map((t, i) => `C${i}: ${t.toString()} wei`).join(", ")}
          </p>

          {selectedEvent.isOpen && (
            <div className="mb-4">
              <h3 className="font-semibold">Place a Bet</h3>
              <input
                className="input input-bordered w-full mb-2"
                type="number"
                placeholder="Candidate index"
                value={betCandidate}
                onChange={e => setBetCandidate(Number(e.target.value))}
              />
              <input
                className="input input-bordered w-full mb-2"
                type="text"
                placeholder="Amount in ETH"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
              />
              <button className="btn btn-primary" onClick={placeBet}>
                Place Bet
              </button>
            </div>
          )}

          {selectedEvent.creator === connectedAddress && selectedEvent.isOpen && (
            <div className="mb-4">
              <h3 className="font-semibold">Close Betting (only creator)</h3>
              <button className="btn btn-primary" onClick={closeBetting}>
                Close Betting
              </button>
            </div>
          )}

          {selectedEvent.creator === connectedAddress && !selectedEvent.isOpen && !selectedEvent.resolved && (
            <div className="mb-4">
              <h3 className="font-semibold">Resolve Event (only creator)</h3>
              <input
                className="input input-bordered w-full mb-2"
                type="number"
                placeholder="Winner candidate index"
                value={resolveCandidate}
                onChange={e => setResolveCandidate(Number(e.target.value))}
              />
              <button className="btn btn-primary" onClick={resolveEvent}>
                Resolve Event
              </button>
            </div>
          )}

          {selectedEvent.resolved && (
            <div className="mb-4">
              <h3 className="font-semibold">Claim Winnings</h3>
              <button className="btn btn-primary" onClick={claimWinnings}>
                Claim
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
