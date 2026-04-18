from algopy import (
    ARC4Contract,
    GlobalState,
    BoxMap,
    Txn,
    arc4,
)

# --- Struct ---

class Fiduciary(arc4.Struct):
    name: arc4.String
    license_id: arc4.String
    approved: arc4.Bool
    suspended: arc4.Bool
    revoked: arc4.Bool


# --- Contract ---

class DataFiduciaryRegistry(ARC4Contract):

    def __init__(self) -> None:
        # Store the admin (deployer) address
        self.admin = GlobalState(arc4.Address, key="admin")
        self.admin.value = arc4.Address(Txn.sender)

        # BoxMap: fiduciary address -> Fiduciary struct
        self.fiduciaries = BoxMap(arc4.Address, Fiduciary, key_prefix=b"fid_")

    @arc4.abimethod
    def register_fiduciary(
        self,
        name: arc4.String,
        license_id: arc4.String,
    ) -> None:
        """Any caller can register themselves as a fiduciary (pending approval)."""
        sender_addr = arc4.Address(Txn.sender)
        self.fiduciaries[sender_addr] = Fiduciary(
            name=name,
            license_id=license_id,
            approved=arc4.Bool(False),
            suspended=arc4.Bool(False),
            revoked=arc4.Bool(False),
        ).copy()

        # Emit ARC-28 event
        arc4.emit("FiduciaryRegistered", sender_addr)

    @arc4.abimethod
    def approve_fiduciary(self, fiduciary: arc4.Address) -> None:
        """Only admin can approve a fiduciary."""
        assert arc4.Address(Txn.sender) == self.admin.value, "Only admin"
        
        entry = self.fiduciaries[fiduciary].copy()
        assert not entry.revoked.native, "Cannot approve revoked fiduciary"
        entry.approved = arc4.Bool(True)
        self.fiduciaries[fiduciary] = entry.copy()

        arc4.emit("FiduciaryApproved", fiduciary)

    @arc4.abimethod
    def suspend_fiduciary(self, fiduciary: arc4.Address) -> None:
        """Only admin can suspend a fiduciary."""
        assert arc4.Address(Txn.sender) == self.admin.value, "Only admin"

        entry = self.fiduciaries[fiduciary].copy()
        assert not entry.revoked.native, "Cannot suspend revoked fiduciary"
        entry.suspended = arc4.Bool(True)
        self.fiduciaries[fiduciary] = entry.copy()

        arc4.emit("FiduciarySuspended", fiduciary)

    @arc4.abimethod
    def revoke_fiduciary(self, fiduciary: arc4.Address) -> None:
        """Only admin can permanently revoke a fiduciary."""
        assert arc4.Address(Txn.sender) == self.admin.value, "Only admin"
        
        entry = self.fiduciaries[fiduciary].copy()
        entry.revoked = arc4.Bool(True)
        entry.approved = arc4.Bool(False)
        entry.suspended = arc4.Bool(True)
        self.fiduciaries[fiduciary] = entry.copy()
        
        arc4.emit("FiduciaryRevoked", fiduciary)


    @arc4.abimethod(readonly=True)
    def is_approved(self, fiduciary: arc4.Address) -> arc4.Bool:
        """Returns True if fiduciary is approved, not suspended, and not revoked."""
        if fiduciary in self.fiduciaries:
            entry = self.fiduciaries[fiduciary].copy()
            return arc4.Bool(entry.approved.native and not entry.suspended.native and not entry.revoked.native)
        return arc4.Bool(False)

    @arc4.abimethod(readonly=True)
    def get_fiduciary(self, fiduciary: arc4.Address) -> Fiduciary:
        """Returns the Fiduciary struct for a given address."""
        return self.fiduciaries[fiduciary].copy()
