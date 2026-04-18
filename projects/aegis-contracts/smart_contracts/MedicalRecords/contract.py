from algopy import (
    ARC4Contract,
    GlobalState,
    BoxMap,
    UInt64,
    Txn,
    arc4,
    op,
    Application,
    urange
)


# --- Structs ---

class Record(arc4.Struct):
    id: arc4.UInt64
    patient: arc4.Address
    provider: arc4.Address
    cid: arc4.String
    previous_cid: arc4.String    # For versioning
    record_type: arc4.String
    timestamp: arc4.UInt64
    bill_amount: arc4.UInt64


class PrescriptionQueueItem(arc4.Struct):
    record_id: arc4.UInt64
    patient: arc4.Address
    patient_name: arc4.String
    cid: arc4.String
    is_dispensed: arc4.Bool
    bill_amount: arc4.UInt64


# --- Contract ---

class MedicalRecords(ARC4Contract):

    def __init__(self) -> None:
        self.record_counter = GlobalState(UInt64, key="rec_counter")
        self.record_counter.value = UInt64(0)

        self.audit_app = GlobalState(UInt64, key="audit_app")
        self.audit_app.value = UInt64(0)

        # BoxMap: patient address -> dynamic array of Records
        self.patient_records = BoxMap(
            arc4.Address, arc4.DynamicArray[Record], key_prefix=b"pr_"
        )

        # Global prescription queue stored as a box
        # Key is a fixed bytes key, value is a dynamic array of PrescriptionQueueItem
        self.prescription_queue = BoxMap(
            arc4.UInt64, PrescriptionQueueItem, key_prefix=b"pq_"
        )

        # Track total prescription queue length
        self.queue_length = GlobalState(UInt64, key="q_len")
        self.queue_length.value = UInt64(0)

    @arc4.abimethod
    def bootstrap(self, audit_app_id: arc4.UInt64) -> None:
        """Set the AuditLog app ID (called once after deploy)."""
        self.audit_app.value = audit_app_id.native

    @arc4.abimethod
    def add_record(
        self,
        patient: arc4.Address,
        cid: arc4.String,
        previous_cid: arc4.String,
        record_type: arc4.String,
        bill_amount: arc4.UInt64,
    ) -> None:
        """Approved fiduciaries (Labs, Doctors, etc.) map a CID to a patient."""
        self.record_counter.value += UInt64(1)
        now = op.Global.latest_timestamp

        new_record = Record(
            id=arc4.UInt64(self.record_counter.value),
            patient=patient,
            provider=arc4.Address(Txn.sender),
            cid=cid,
            previous_cid=previous_cid,
            record_type=record_type,
            timestamp=arc4.UInt64(now),
            bill_amount=bill_amount,
        )

        if patient in self.patient_records:
            arr = self.patient_records[patient].copy()
            arr.append(new_record.copy())
            self.patient_records[patient] = arr.copy()
        else:
            arr = arc4.DynamicArray[Record](new_record.copy())
            self.patient_records[patient] = arr.copy()

        # Log to AuditLog contract via inner transaction ONLY if initialized
        if self.audit_app.value != UInt64(0):
            arc4.abi_call(
                "log_data_accessed(address,address,string,uint64,bool)void",
                patient,
                arc4.Address(Txn.sender),
                arc4.String("Uploaded new record"),
                arc4.UInt64(now),
                arc4.Bool(False),
                app_id=Application(self.audit_app.value),
            )

        # Emit ARC-28 event
        arc4.emit(
            "RecordAdded(uint64,address,address,string,string,uint64)",
            arc4.UInt64(self.record_counter.value),
            patient,
            arc4.Address(Txn.sender),
            cid,
            record_type,
            arc4.UInt64(now),
        )

    @arc4.abimethod
    def add_prescription(
        self,
        patient: arc4.Address,
        patient_name: arc4.String,
        cid: arc4.String,
    ) -> None:
        """Add a prescription to the global queue and to the patient's record history."""
        self.record_counter.value += UInt64(1)
        now = op.Global.latest_timestamp
        rec_id = arc4.UInt64(self.record_counter.value)

        # Add to prescription queue (keyed by queue index)
        queue_idx = arc4.UInt64(self.queue_length.value)
        self.prescription_queue[queue_idx] = PrescriptionQueueItem(
            record_id=rec_id,
            patient=patient,
            patient_name=patient_name,
            cid=cid,
            is_dispensed=arc4.Bool(False),
            bill_amount=arc4.UInt64(0),
        ).copy()
        self.queue_length.value += UInt64(1)

        # Also add to patient's record history
        new_record = Record(
            id=rec_id,
            patient=patient,
            provider=arc4.Address(Txn.sender),
            cid=cid,
            previous_cid=arc4.String(""),
            record_type=arc4.String("Prescription"),
            timestamp=arc4.UInt64(now),
            bill_amount=arc4.UInt64(0),
        )

        if patient in self.patient_records:
            arr = self.patient_records[patient].copy()
            arr.append(new_record.copy())
            self.patient_records[patient] = arr.copy()
        else:
            arr = arc4.DynamicArray[Record](new_record.copy())
            self.patient_records[patient] = arr.copy()

        if self.audit_app.value != UInt64(0):
            arc4.abi_call(
                "log_data_accessed(address,address,string,uint64,bool)void",
                patient,
                arc4.Address(Txn.sender),
                arc4.String("Uploaded new Prescription to Global Queue"),
                arc4.UInt64(now),
                arc4.Bool(False),
                app_id=Application(self.audit_app.value),
            )

        arc4.emit(
            "PrescriptionAddedToQueue(uint64,address,string)",
            rec_id,
            patient,
            patient_name,
        )

    @arc4.abimethod(readonly=True)
    def get_pending_prescriptions(
        self,
    ) -> arc4.DynamicArray[PrescriptionQueueItem]:
        """Return all prescription queue items that have not been dispensed."""
        pending = arc4.DynamicArray[PrescriptionQueueItem]()
        total = self.queue_length.value
        for i in urange(total):
            item = self.prescription_queue[arc4.UInt64(i)].copy()
            if not item.is_dispensed.native:
                pending.append(item.copy())
        return pending.copy()

    @arc4.abimethod
    def mark_prescription_dispensed(
        self,
        record_id: arc4.UInt64,
        bill_amount: arc4.UInt64,
    ) -> None:
        """Mark a prescription as dispensed and update the bill amount."""
        total = self.queue_length.value
        for i in urange(total):
            idx = arc4.UInt64(i)
            item = self.prescription_queue[idx].copy()
            if item.record_id == record_id:
                item.is_dispensed = arc4.Bool(True)
                item.bill_amount = bill_amount
                self.prescription_queue[idx] = item.copy()

                # Update the patient's record history with the bill amount
                patient = item.patient
                if patient in self.patient_records:
                    arr = self.patient_records[patient].copy()
                    for j in urange(arr.length):
                        rec = arr[j].copy()
                        if rec.id == record_id:
                            rec.bill_amount = bill_amount
                            arr[j] = rec.copy()
                            break
                    self.patient_records[patient] = arr.copy()

                arc4.emit(
                    "PrescriptionDispensed(uint64,uint64)",
                    record_id,
                    bill_amount,
                )
                break

    @arc4.abimethod(readonly=True)
    def get_patient_records(
        self, patient: arc4.Address
    ) -> arc4.DynamicArray[Record]:
        """Return all records mapped to a patient's address."""
        if patient in self.patient_records:
            return self.patient_records[patient].copy()
        return arc4.DynamicArray[Record]()
