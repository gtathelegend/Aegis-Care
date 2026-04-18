import typing
from algopy import (
    ARC4Contract,
    BoxMap,
    Txn,
    arc4,
    subroutine,
    urange,
)


# A 6-byte static array to represent the short ID
ShortID: typing.TypeAlias = arc4.StaticArray[arc4.Byte, typing.Literal[6]]

class BeneficiaryRecord(arc4.Struct):
    beneficiary_id: ShortID
    beneficiary_wallet: arc4.Address
    hashed_password: arc4.String
    created_at: arc4.UInt64


class WalletMapper(ARC4Contract):

    def __init__(self) -> None:
        # BoxMap: 6-byte short ID -> wallet address
        self.short_id_to_address = BoxMap(
            ShortID,
            arc4.Address,
            key_prefix=b"sid_",
        )

        # BoxMap: wallet address -> 6-byte short ID
        self.address_to_short_id = BoxMap(
            arc4.Address,
            ShortID,
            key_prefix=b"adr_",
        )

        # BoxMap: owner wallet address -> array of BeneficiaryRecord
        self.beneficiaries = BoxMap(
            arc4.Address,
            arc4.DynamicArray[BeneficiaryRecord],
            key_prefix=b"ben_"
        )

    @arc4.abimethod
    def fund_app(self, pay: arc4.UInt64) -> None:
        """Helper method to allow funding the contract for box MBR."""
        # This method's logic is actually handled by the payment transaction itself
        # but having the method makes it easier to track in audit logs.
        pass

    @arc4.abimethod
    def register_short_id(self, short_id: ShortID) -> None:
        """Register a 6-byte short ID for the caller's wallet."""
        caller = arc4.Address(Txn.sender)

        # check if already registered
        if caller in self.address_to_short_id:
            # If they are registering the SAME ID again, just return (idempotent)
            if self.address_to_short_id[caller] == short_id:
                return
            else:
                # If they want a DIFFERENT ID, they must clear the old one first
                assert False, "Wallet already has a different Short ID. Clear it first."

        # Check short ID is not already taken by someone else
        assert short_id not in self.short_id_to_address, "Short ID already taken"

        self.short_id_to_address[short_id] = caller
        self.address_to_short_id[caller] = short_id.copy()

        arc4.emit("ShortIdRegistered(address,byte[6])", caller, short_id)

    @arc4.abimethod
    def clear_registration(self) -> None:
        """Allow the caller to remove their own short ID registration."""
        caller = arc4.Address(Txn.sender)
        assert caller in self.address_to_short_id, "Not registered"

        old_id = self.address_to_short_id[caller].copy()
        
        del self.address_to_short_id[caller]
        del self.short_id_to_address[old_id]

    @arc4.abimethod(readonly=True)
    def get_wallet_from_short_id(self, short_id: ShortID) -> arc4.Address:
        """Returns the wallet address corresponding to a short ID."""
        assert short_id in self.short_id_to_address, "Short ID not found"
        return self.short_id_to_address[short_id].copy()

    @arc4.abimethod(readonly=True)
    def get_short_id_from_wallet(self, wallet: arc4.Address) -> ShortID:
        """Returns the short ID corresponding to a wallet address."""
        assert wallet in self.address_to_short_id, "Wallet not registered"
        return self.address_to_short_id[wallet].copy()

    @arc4.abimethod
    def add_beneficiary(self, beneficiary_id: ShortID, hashed_password: arc4.String) -> None:
        """Adds a proxy beneficiary link to the caller's wallet."""
        from algopy import op
        owner = arc4.Address(Txn.sender)
        
        assert beneficiary_id in self.short_id_to_address, "Beneficiary ID not found"
        ben_wallet = self.short_id_to_address[beneficiary_id]
        
        assert owner != ben_wallet, "Cannot add self"
        
        # Prevent duplicates
        if owner in self.beneficiaries:
            existing = self.beneficiaries[owner].copy()
            for i in urange(existing.length):
                if existing[i].beneficiary_id == beneficiary_id:
                    return # Already registered, skip to avoid duplicates

        now = op.Global.latest_timestamp
        record = BeneficiaryRecord(
            beneficiary_id=beneficiary_id.copy(),
            beneficiary_wallet=ben_wallet.copy(),
            hashed_password=hashed_password,
            created_at=arc4.UInt64(now)
        )
        
        if owner in self.beneficiaries:
            arr = self.beneficiaries[owner].copy()
            arr.append(record.copy())
            self.beneficiaries[owner] = arr.copy()
        else:
            arr = arc4.DynamicArray[BeneficiaryRecord](record.copy())
            self.beneficiaries[owner] = arr.copy()

    @arc4.abimethod
    def clear_beneficiaries(self) -> None:
        """Allow the caller to remove all their proxy beneficiaries."""
        owner = arc4.Address(Txn.sender)
        if owner in self.beneficiaries:
            del self.beneficiaries[owner]

    @arc4.abimethod(readonly=True)
    def get_beneficiaries(self, owner: arc4.Address) -> arc4.DynamicArray[BeneficiaryRecord]:
        if owner in self.beneficiaries:
            return self.beneficiaries[owner].copy()
        return arc4.DynamicArray[BeneficiaryRecord]()
