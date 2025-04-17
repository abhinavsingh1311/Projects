<Query Kind="Program">
  <Connection>
    <ID>f33d1a5f-7b5a-41b0-b948-17d919659c45</ID>
    <NamingServiceVersion>2</NamingServiceVersion>
    <Persist>true</Persist>
    <Driver Assembly="(internal)" PublicKeyToken="no-strong-name">LINQPad.Drivers.EFCore.DynamicDriver</Driver>
    <AllowDateOnlyTimeOnly>true</AllowDateOnlyTimeOnly>
    <Server>ABHINAV-SCHOOL</Server>
    <Database>eBike_2025</Database>
    <DriverData>
      <EncryptSqlTraffic>True</EncryptSqlTraffic>
      <PreserveNumeric1>True</PreserveNumeric1>
      <EFProvider>Microsoft.EntityFrameworkCore.SqlServer</EFProvider>
    </DriverData>
  </Connection>
  <Namespace>Receiving</Namespace>
</Query>

#load "c:\dmit2018\linq_queries\PurchaseOrderView.linq"
#load "c:\dmit2018\linq_queries\ReceivingDetailView.linq"

void Main()
{
	try
	{
		GetReceivingOrderDetails(571).Dump();
	}
	catch(AggregateException ex)
	{
		foreach (var error in ex.InnerExceptions)
		{
            error.Message.Dump();
        }
	}
	catch(ArgumentNullException ex)
	{
		ex.Message.Dump();
	}
	catch(Exception ex)
	{
		ex.Message.Dump();
	}
}

	public List<ReceivingDetailView> GetReceivingOrderDetails(int purchaseOrderID)
		{
			return PurchaseOrderDetails
				.Where(x => x.PurchaseOrderID == purchaseOrderID && !x.RemoveFromViewFlag)
				.Select(x => new ReceivingDetailView
				{
					PurchaseOrderDetailID = x.PurchaseOrderDetailID,
					PartID = x.PartID,
					Description = x.Part.Description,
					Quantity = x.Quantity,
					Outstanding = x.Quantity - (x.ReceiveOrderDetails.Any() ? x.ReceiveOrderDetails.Sum(y => y.QuantityReceived) : 0),
					Received = 0,
					Returned = 0,
					ReturnReason = string.Empty,
					PurchasePrice = x.PurchasePrice
				})
				.Where(x => x.Outstanding > 0)
				.ToList();
		}