<Query Kind="Statements" />


namespace Receiving {
public class ReceivingDetailView
{
    public int PurchaseOrderDetailID { get; set; }
    public int PartID { get; set; }
    public string Description { get; set; }
    public int Quantity { get; set; }
    public int Outstanding { get; set; }
    public int Received { get; set; } = 0;
    public int Returned { get; set; } = 0;
    public string ReturnReason { get; set; } = string.Empty;
    public decimal PurchasePrice { get; set; }
}
}