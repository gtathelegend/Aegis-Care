from algopy import (
    ARC4Contract,
    BoxMap,
    Txn,
    arc4,
    subroutine,
)
import typing


# --- Struct ---

class Volunteer(arc4.Struct):
    cid: arc4.String
    active: arc4.Bool


# --- Contract ---

class VolunteerRegistry(ARC4Contract):

    def __init__(self) -> None:
        # BoxMap: bytes32 hash (as 32-byte StaticArray) -> Volunteer struct
        self.volunteers = BoxMap(
            arc4.StaticArray[arc4.Byte, typing.Literal[32]],
            Volunteer,
            key_prefix=b"vol_",
        )

    @arc4.abimethod
    def add_volunteer(
        self,
        hash_id: arc4.StaticArray[arc4.Byte, typing.Literal[32]],
        cid: arc4.String,
    ) -> None:
        self.volunteers[hash_id] = Volunteer(
            cid=cid,
            active=arc4.Bool(True),
        ).copy()

        arc4.emit("VolunteerAdded(byte[32],string)", hash_id, cid)

    @arc4.abimethod
    def update_status(
        self,
        hash_id: arc4.StaticArray[arc4.Byte, typing.Literal[32]],
        active: arc4.Bool,
    ) -> None:
        entry = self.volunteers[hash_id].copy()
        entry.active = active
        self.volunteers[hash_id] = entry.copy()

        arc4.emit("StatusUpdated(byte[32],bool)", hash_id, active)

    @arc4.abimethod(readonly=True)
    def get_volunteer(
        self,
        hash_id: arc4.StaticArray[arc4.Byte, typing.Literal[32]],
    ) -> Volunteer:
        return self.volunteers[hash_id].copy()
