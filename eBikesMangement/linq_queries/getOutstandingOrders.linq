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
void Main()
{
try{
getOustandingOrder().Dump();
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

public List<PurchaseOrderListViewModel> getOustandingOrder() {
return PurchaseOrders.Where(x=> (x.Closed == false) && (x.OrderDate != null) && (x.RemoveFromViewFlag == false))
.Select(x=> new PurchaseOrderListViewModel
{
					PurchaseOrderID = x.PurchaseOrderID,
					PurchaseOrderNumber = x.PurchaseOrderNumber,
					OrderDate = x.OrderDate.Value,
					VendorName = x.Vendor.VendorName,
					Phone = x.Vendor.Phone,
					Closed = x.Closed
})
.OrderByDescending(x=> x.OrderDate)
.ToList()
;
}