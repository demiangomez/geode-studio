import { useState } from "react";
import { AxiosInstance } from "axios";

import { Alert, Modal } from "@componentsReact";

import {
    useInvalidateCampaignPlans,
    useSaveCampaignPlan,
} from "@hooks/queries";

import { AlertMsg, CampaignPlanData, CampaignPlanParams } from "@types";

import { modalActions, toAlertMsg } from "@utils";

export interface SavedPlanRef {
    id: number;
    name: string;
}

interface Props {
    api: AxiosInstance;
    params: CampaignPlanParams;
    saved: SavedPlanRef | undefined;
    onSaved: (plan: CampaignPlanData) => void;
    closeModal: () => void;
}

// Solo se guardan los parametros: el plan se regenera al abrirlo
const SavePlanModal = ({ api, params, saved, onSaved, closeModal }: Props) => {
    const [name, setName] = useState(saved?.name ?? "");
    const [msg, setMsg] = useState<AlertMsg | undefined>();

    const saveMutation = useSaveCampaignPlan(api);
    const invalidatePlans = useInvalidateCampaignPlans();

    const nameError = msg?.errors?.errors?.find((e) => e.attr === "name");

    const save = (id: number | undefined) => {
        setMsg(undefined);
        saveMutation.mutate(
            { id, data: { ...params, name: name.trim() } },
            {
                onSuccess: (plan) => {
                    invalidatePlans();
                    onSaved(plan);
                    closeModal();
                },
                onError: (error) => setMsg(toAlertMsg(error)),
            },
        );
    };

    const loading = saveMutation.isPending;

    return (
        <Modal
            close={false}
            modalId="SavePlan"
            size="sm"
            handleCloseModal={closeModal}
        >
            <div className="flex flex-col gap-4">
                <h3 className="font-bold text-center text-2xl my-2">
                    Save plan
                </h3>
                <label className="form-control" title={nameError?.detail}>
                    <span className="label-text font-bold">Name *</span>
                    <div className="relative">
                        <input
                            type="text"
                            maxLength={100}
                            autoComplete="off"
                            className={`input input-bordered w-full ${nameError ? "input-error" : ""}`}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        {nameError && (
                            <span className="badge badge-error absolute right-2 -top-2 z-[1]">
                                {nameError.code.toUpperCase()}
                            </span>
                        )}
                    </div>
                </label>
                <span className="text-sm opacity-70">
                    Only the parameters are saved. The plan is generated again
                    each time you open it.
                </span>

                <Alert msg={msg} />

                <div className={modalActions.container}>
                    {saved && (
                        <button
                            type="button"
                            className={modalActions.secondary}
                            disabled={loading}
                            onClick={() => save(undefined)}
                        >
                            Save as new
                        </button>
                    )}
                    <button
                        type="button"
                        className={modalActions.primary}
                        disabled={loading}
                        onClick={() => save(saved?.id)}
                    >
                        {saved ? "Save changes" : "Save"}
                        {loading && (
                            <span className="loading loading-spinner loading-md"></span>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default SavePlanModal;
