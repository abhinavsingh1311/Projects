<Query Kind="Statements">
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
</Query>

namespace Receiving {
public class PurchaseOrderListViewModel
{
    public int PurchaseOrderID { get; set; }
    public int PurchaseOrderNumber { get; set; }
    public DateTime OrderDate { get; set; }
    public string VendorName { get; set; }
    public string Phone { get; set; }
    public bool Closed { get; set; }
}
}
