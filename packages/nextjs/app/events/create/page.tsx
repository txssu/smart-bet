"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ContractFunctionExecutionError, ContractFunctionRevertedError } from "viem";
import { useWalletClient } from "wagmi";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";

function handleError(err: ContractFunctionExecutionError) {
  const cause = err.cause;
  if (cause instanceof ContractFunctionRevertedError) {
    alert(`Transaction reverted: ${cause.reason}`);
  }
}

export default function CreateEventPage() {
  const router = useRouter();
  const [newEventName, setNewEventName] = useState("");
  const [newEventCandidates, setNewEventCandidates] = useState<number>(2);

  const { data: walletClient } = useWalletClient();
  const { data: contract, isLoading } = useScaffoldContract({ contractName: "Betting", walletClient });

  const createEvent = async () => {
    await contract?.write
      .createEvent([newEventName, newEventCandidates], {})
      .then(() => router.push("/"))
      .catch(handleError);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-8">
      <h2 className="text-xl font-semibold mb-4">Create New Event</h2>
      <input
        className="input input-bordered w-full mb-2"
        placeholder="Event Name"
        value={newEventName}
        onChange={e => setNewEventName(e.target.value)}
      />
      <input
        className="input input-bordered w-full mb-2"
        type="number"
        placeholder="Number of candidates"
        value={newEventCandidates}
        onChange={e => setNewEventCandidates(Number(e.target.value))}
      />
      <button className="btn btn-primary" onClick={createEvent}>
        Create Event
      </button>
    </div>
  );
}
