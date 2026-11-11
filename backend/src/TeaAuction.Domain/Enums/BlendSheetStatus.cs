namespace TeaAuction.Domain;

public enum BlendSheetStatus
{
    Draft = 0,
    /// <summary>Temp inventory holds are active; composition still editable.</summary>
    TempAllocated = 1,
    /// <summary>Composition confirmed; allocations firm against estimated qty.</summary>
    Confirmed = 2,
    Rejected = 3,
    Cancelled = 4
}
