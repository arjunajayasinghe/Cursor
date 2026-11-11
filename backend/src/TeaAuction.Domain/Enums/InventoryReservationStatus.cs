namespace TeaAuction.Domain;

public enum InventoryReservationStatus
{
    Temp = 0,
    Active = 1,
    Approved = 2,
    PartiallyConsumed = 3,
    Closed = 4,
    Released = 5
}
